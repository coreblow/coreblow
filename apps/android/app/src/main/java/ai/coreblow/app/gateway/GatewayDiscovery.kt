package ai.coreblow.app.gateway

import android.content.Context
import android.net.ConnectivityManager
import android.net.DnsResolver
import android.net.NetworkCapabilities
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.CancellationSignal
import android.util.Log
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.xbill.DNS.AAAARecord
import org.xbill.DNS.ARecord
import org.xbill.DNS.DClass
import org.xbill.DNS.ExtendedResolver
import org.xbill.DNS.Message
import org.xbill.DNS.Name
import org.xbill.DNS.PTRRecord
import org.xbill.DNS.Record
import org.xbill.DNS.Rcode
import org.xbill.DNS.Resolver
import org.xbill.DNS.SRVRecord
import org.xbill.DNS.Section
import org.xbill.DNS.SimpleResolver
import org.xbill.DNS.TextParseException
import org.xbill.DNS.TXTRecord
import org.xbill.DNS.Type
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Discovers CoreBlow gateway instances via:
 * 1. Local mDNS/NSD (multicast DNS-SD on LAN)
 * 2. Wide-area unicast DNS-SD (when COREBLOW_WIDE_AREA_DOMAIN is set)
 *
 * Maintains a live, deduplicated list sorted by name.
 */
@Suppress("DEPRECATION")
class GatewayDiscovery(
    context: Context,
    private val scope: CoroutineScope,
) {
    private val nsd = context.getSystemService(NsdManager::class.java)
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val dns = DnsResolver.getInstance()
    private val serviceType = "_coreblow-gw._tcp."
    private val wideAreaDomain = System.getenv("COREBLOW_WIDE_AREA_DOMAIN")
    private val logTag = "CoreBlow/GatewayDiscovery"

    private val localById = ConcurrentHashMap<String, GatewayEndpoint>()
    private val unicastById = ConcurrentHashMap<String, GatewayEndpoint>()
    private val _gateways = MutableStateFlow<List<GatewayEndpoint>>(emptyList())
    val gateways: StateFlow<List<GatewayEndpoint>> = _gateways.asStateFlow()

    private val _statusText = MutableStateFlow("Searching…")
    val statusText: StateFlow<String> = _statusText.asStateFlow()

    private var unicastJob: Job? = null
    private val dnsExecutor: Executor = Executors.newCachedThreadPool()

    @Volatile private var lastWideAreaRcode: Int? = null
    @Volatile private var lastWideAreaCount: Int = 0

    // ── NSD listener ────────────────────────────────────

    private val discoveryListener = object : NsdManager.DiscoveryListener {
        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        override fun onDiscoveryStarted(serviceType: String) {}
        override fun onDiscoveryStopped(serviceType: String) {}

        override fun onServiceFound(serviceInfo: NsdServiceInfo) {
            if (serviceInfo.serviceType != this@GatewayDiscovery.serviceType) return
            resolve(serviceInfo)
        }

        override fun onServiceLost(serviceInfo: NsdServiceInfo) {
            val serviceName = BonjourEscapes.decode(serviceInfo.serviceName)
            val id = stableId(serviceName, "local.")
            localById.remove(id)
            publish()
        }
    }

    init {
        startLocalDiscovery()
        if (!wideAreaDomain.isNullOrBlank()) {
            startUnicastDiscovery(wideAreaDomain)
        }
    }

    // ── Local discovery ─────────────────────────────────

    private fun startLocalDiscovery() {
        try { nsd.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener) }
        catch (_: Throwable) {}
    }

    private fun stopLocalDiscovery() {
        try { nsd.stopServiceDiscovery(discoveryListener) }
        catch (_: Throwable) {}
    }

    // ── Unicast (wide-area) discovery ───────────────────

    private fun startUnicastDiscovery(domain: String) {
        unicastJob = scope.launch(Dispatchers.IO) {
            while (true) {
                try { refreshUnicast(domain) } catch (_: Throwable) {}
                delay(5000)
            }
        }
    }

    // ── Resolve ─────────────────────────────────────────

    private fun resolve(serviceInfo: NsdServiceInfo) {
        nsd.resolveService(serviceInfo, object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
            override fun onServiceResolved(resolved: NsdServiceInfo) {
                val host = resolved.host?.hostAddress ?: return
                val port = resolved.port
                if (port <= 0) return

                val rawServiceName = resolved.serviceName
                val serviceName = BonjourEscapes.decode(rawServiceName)
                val displayName = BonjourEscapes.decode(txt(resolved, "displayName") ?: serviceName)
                val lanHost = txt(resolved, "lanHost")
                val tailnetDns = txt(resolved, "tailnetDns")
                val gatewayPort = txtInt(resolved, "gatewayPort")
                val canvasPort = txtInt(resolved, "canvasPort")
                val tlsEnabled = txtBool(resolved, "gatewayTls")
                val tlsFingerprint = txt(resolved, "gatewayTlsSha256")
                val id = stableId(serviceName, "local.")
                localById[id] = GatewayEndpoint(
                    stableId = id, name = displayName, host = host, port = port,
                    lanHost = lanHost, tailnetDns = tailnetDns,
                    gatewayPort = gatewayPort, canvasPort = canvasPort,
                    tlsEnabled = tlsEnabled, tlsFingerprintSha256 = tlsFingerprint,
                )
                publish()
            }
        })
    }

    // ── Publish ─────────────────────────────────────────

    private fun publish() {
        _gateways.value = (localById.values + unicastById.values).sortedBy { it.name.lowercase() }
        _statusText.value = buildStatusText()
    }

    private fun buildStatusText(): String {
        val localCount = localById.size
        val wideRcode = lastWideAreaRcode
        val wideCount = lastWideAreaCount

        val wide = when (wideRcode) {
            null -> "Wide: ?"
            Rcode.NOERROR -> "Wide: $wideCount"
            Rcode.NXDOMAIN -> "Wide: NXDOMAIN"
            else -> "Wide: ${Rcode.string(wideRcode)}"
        }

        return when {
            localCount == 0 && wideRcode == null -> "Searching for gateways…"
            localCount == 0 -> wide
            else -> "Local: $localCount • $wide"
        }
    }

    // ── Unicast refresh ─────────────────────────────────

    private suspend fun refreshUnicast(domain: String) {
        val ptrName = "${serviceType}${domain}"
        val ptrMsg = lookupUnicastMessage(ptrName, Type.PTR) ?: return
        val ptrRecords = records(ptrMsg, Section.ANSWER).mapNotNull { it as? PTRRecord }

        val next = LinkedHashMap<String, GatewayEndpoint>()
        for (ptr in ptrRecords) {
            val instanceFqdn = ptr.target.toString()
            val srv = recordByName(ptrMsg, instanceFqdn, Type.SRV) as? SRVRecord
                ?: run {
                    val msg = lookupUnicastMessage(instanceFqdn, Type.SRV) ?: return@run null
                    recordByName(msg, instanceFqdn, Type.SRV) as? SRVRecord
                } ?: continue
            val port = srv.port
            if (port <= 0) continue

            val targetFqdn = srv.target.toString()
            val host = resolveHostFromMessage(ptrMsg, targetFqdn)
                ?: resolveHostFromMessage(lookupUnicastMessage(instanceFqdn, Type.SRV), targetFqdn)
                ?: resolveHostUnicast(targetFqdn) ?: continue

            val txtFromPtr = recordsByName(ptrMsg, Section.ADDITIONAL)[keyName(instanceFqdn)].orEmpty().mapNotNull { it as? TXTRecord }
            val txt = if (txtFromPtr.isNotEmpty()) txtFromPtr
            else { val msg = lookupUnicastMessage(instanceFqdn, Type.TXT); records(msg, Section.ANSWER).mapNotNull { it as? TXTRecord } }

            val instanceName = BonjourEscapes.decode(decodeInstanceName(instanceFqdn, domain))
            val displayName = BonjourEscapes.decode(txtValue(txt, "displayName") ?: instanceName)
            val lanHost = txtValue(txt, "lanHost")
            val tailnetDns = txtValue(txt, "tailnetDns")
            val gatewayPort = txtIntValue(txt, "gatewayPort")
            val canvasPort = txtIntValue(txt, "canvasPort")
            val tlsEnabled = txtBoolValue(txt, "gatewayTls")
            val tlsFingerprint = txtValue(txt, "gatewayTlsSha256")
            val id = stableId(instanceName, domain)
            next[id] = GatewayEndpoint(
                stableId = id, name = displayName, host = host, port = port,
                lanHost = lanHost, tailnetDns = tailnetDns,
                gatewayPort = gatewayPort, canvasPort = canvasPort,
                tlsEnabled = tlsEnabled, tlsFingerprintSha256 = tlsFingerprint,
            )
        }

        unicastById.clear(); unicastById.putAll(next)
        lastWideAreaRcode = ptrMsg.header.rcode; lastWideAreaCount = next.size
        publish()

        if (next.isEmpty()) {
            Log.d(logTag, "wide-area discovery: 0 results for $ptrName (rcode=${Rcode.string(ptrMsg.header.rcode)})")
        }
    }

    // ── DNS helpers ─────────────────────────────────────

    private fun stableId(serviceName: String, domain: String): String = "${serviceType}|${domain}|${normalizeName(serviceName)}"
    private fun normalizeName(raw: String): String = raw.trim().split(Regex("\\s+")).joinToString(" ")
    private fun keyName(raw: String): String = raw.trim().lowercase()

    private fun decodeInstanceName(instanceFqdn: String, domain: String): String {
        val suffix = "${serviceType}${domain}"
        val withoutSuffix = if (instanceFqdn.endsWith(suffix)) instanceFqdn.removeSuffix(suffix) else instanceFqdn.substringBefore(serviceType)
        return normalizeName(withoutSuffix.removeSuffix("."))
    }

    // ── TXT parsing (NsdServiceInfo) ────────────────────

    private fun txt(info: NsdServiceInfo, key: String): String? {
        val bytes = info.attributes[key] ?: return null
        return try { String(bytes, Charsets.UTF_8).trim().ifEmpty { null } } catch (_: Throwable) { null }
    }

    private fun txtInt(info: NsdServiceInfo, key: String): Int? = txt(info, key)?.toIntOrNull()

    private fun txtBool(info: NsdServiceInfo, key: String): Boolean {
        val raw = txt(info, key)?.trim()?.lowercase() ?: return false
        return raw == "1" || raw == "true" || raw == "yes"
    }

    // ── TXT parsing (dnsjava) ───────────────────────────

    private fun txtValue(records: List<TXTRecord>, key: String): String? {
        val prefix = "$key="
        for (r in records) {
            val strings: List<String> = try { r.strings.mapNotNull { it as? String } } catch (_: Throwable) { emptyList() }
            for (s in strings) {
                val trimmed = decodeDnsTxtString(s).trim()
                if (trimmed.startsWith(prefix)) return trimmed.removePrefix(prefix).trim().ifEmpty { null }
            }
        }
        return null
    }

    private fun txtIntValue(records: List<TXTRecord>, key: String): Int? = txtValue(records, key)?.toIntOrNull()

    private fun txtBoolValue(records: List<TXTRecord>, key: String): Boolean {
        val raw = txtValue(records, key)?.trim()?.lowercase() ?: return false
        return raw == "1" || raw == "true" || raw == "yes"
    }

    private fun decodeDnsTxtString(raw: String): String {
        val bytes = raw.toByteArray(Charsets.ISO_8859_1)
        val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        return try { decoder.decode(ByteBuffer.wrap(bytes)).toString() } catch (_: Throwable) { raw }
    }

    // ── DNS lookups ─────────────────────────────────────

    private suspend fun lookupUnicastMessage(name: String, type: Int): Message? {
        val query = try {
            Message.newQuery(Record.newRecord(Name.fromString(name), type, DClass.IN))
        } catch (_: TextParseException) { return null }

        val system = queryViaSystemDns(query)
        if (records(system, Section.ANSWER).any { it.type == type }) return system

        val direct = createDirectResolver() ?: return system
        return try {
            val msg = direct.send(query)
            if (records(msg, Section.ANSWER).any { it.type == type }) msg else system
        } catch (_: Throwable) { system }
    }

    private suspend fun queryViaSystemDns(query: Message): Message? {
        val network = preferredDnsNetwork()
        val bytes = try { rawQuery(network, query.toWire()) } catch (_: Throwable) { return null }
        return try { Message(bytes) } catch (_: IOException) { null }
    }

    private fun records(msg: Message?, section: Int): List<Record> = msg?.getSectionArray(section)?.toList() ?: emptyList()

    private fun recordsByName(msg: Message, section: Int): Map<String, List<Record>> {
        val next = LinkedHashMap<String, MutableList<Record>>()
        for (r in records(msg, section)) {
            val name = r.name?.toString() ?: continue
            next.getOrPut(keyName(name)) { mutableListOf() }.add(r)
        }
        return next
    }

    private fun recordByName(msg: Message, fqdn: String, type: Int): Record? {
        val key = keyName(fqdn)
        val fromAnswer = recordsByName(msg, Section.ANSWER)[key].orEmpty().firstOrNull { it.type == type }
        if (fromAnswer != null) return fromAnswer
        return recordsByName(msg, Section.ADDITIONAL)[key].orEmpty().firstOrNull { it.type == type }
    }

    private fun resolveHostFromMessage(msg: Message?, hostname: String): String? {
        val m = msg ?: return null
        val key = keyName(hostname)
        val additional = recordsByName(m, Section.ADDITIONAL)[key].orEmpty()
        val a = additional.mapNotNull { it as? ARecord }.mapNotNull { it.address?.hostAddress }
        val aaaa = additional.mapNotNull { it as? AAAARecord }.mapNotNull { it.address?.hostAddress }
        return a.firstOrNull() ?: aaaa.firstOrNull()
    }

    private suspend fun resolveHostUnicast(hostname: String): String? {
        val a = records(lookupUnicastMessage(hostname, Type.A), Section.ANSWER).mapNotNull { it as? ARecord }.mapNotNull { it.address?.hostAddress }
        val aaaa = records(lookupUnicastMessage(hostname, Type.AAAA), Section.ANSWER).mapNotNull { it as? AAAARecord }.mapNotNull { it.address?.hostAddress }
        return a.firstOrNull() ?: aaaa.firstOrNull()
    }

    // ── Network helpers ─────────────────────────────────

    private fun preferredDnsNetwork(): android.net.Network? {
        val cm = connectivity ?: return null
        // Prefer VPN (Tailscale) when present
        cm.allNetworks.firstOrNull { n ->
            val caps = cm.getNetworkCapabilities(n) ?: return@firstOrNull false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        }?.let { return it }
        return cm.activeNetwork
    }

    private fun createDirectResolver(): Resolver? {
        val cm = connectivity ?: return null
        val candidateNetworks = buildList {
            cm.allNetworks.firstOrNull { n ->
                val caps = cm.getNetworkCapabilities(n) ?: return@firstOrNull false
                caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
            }?.let(::add)
            cm.activeNetwork?.let(::add)
        }.distinct()

        val servers = candidateNetworks.asSequence()
            .flatMap { n -> cm.getLinkProperties(n)?.dnsServers?.asSequence() ?: emptySequence() }
            .distinctBy { it.hostAddress ?: it.toString() }
            .toList()
        if (servers.isEmpty()) return null

        return try {
            val resolvers = servers.mapNotNull { addr ->
                try { SimpleResolver().apply { setAddress(InetSocketAddress(addr, 53)); setTimeout(3) } }
                catch (_: Throwable) { null }
            }
            if (resolvers.isEmpty()) return null
            ExtendedResolver(resolvers.toTypedArray()).apply { setTimeout(3) }
        } catch (_: Throwable) { null }
    }

    private suspend fun rawQuery(network: android.net.Network?, wireQuery: ByteArray): ByteArray =
        suspendCancellableCoroutine { cont ->
            val signal = CancellationSignal()
            cont.invokeOnCancellation { signal.cancel() }
            dns.rawQuery(network, wireQuery, DnsResolver.FLAG_EMPTY, dnsExecutor, signal,
                object : DnsResolver.Callback<ByteArray> {
                    override fun onAnswer(answer: ByteArray, rcode: Int) { cont.resume(answer) }
                    override fun onError(error: DnsResolver.DnsException) { cont.resumeWithException(error) }
                })
        }

    // ── Diagnostics (OC parity) ─────────────────────────

    data class DiscoverySnapshot(
        val isScanning: Boolean,
        val discoveredCount: Int,
        val lastScanTimeMs: Long?,
        val scanDurationMs: Long?,
    )

    fun diagnosticSnapshot(): DiscoverySnapshot = DiscoverySnapshot(
        isScanning = _isScanning.value,
        discoveredCount = _discoveredGateways.value.size,
        lastScanTimeMs = lastScanTimeMs,
        scanDurationMs = lastScanDurationMs,
    )

    private var lastScanTimeMs: Long? = null
    private var lastScanDurationMs: Long? = null

    // ── Scan tracking ───────────────────────────────────

    private var scanErrorCount = 0

    fun recordScanStart() {
        lastScanTimeMs = System.currentTimeMillis()
        lastScanDurationMs = null
    }

    fun recordScanEnd(durationMs: Long) {
        lastScanDurationMs = durationMs
    }

    fun recordScanError() {
        scanErrorCount++
    }

    fun totalScanErrors(): Int = scanErrorCount

    fun clearDiscovered() {
        _discoveredGateways.value = emptyList()
        scanErrorCount = 0
    }
}
