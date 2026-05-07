package ai.coreblow.app.gateway

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap

/**
 * Discovers CoreBlow gateway instances on the local network via mDNS/NSD.
 * Maintains a live list of discovered gateways with dedup, expiry,
 * and periodic re-scan for resilience.
 */
class GatewayDiscovery(
    private val context: Context,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO),
) {
    companion object {
        private const val TAG = "GatewayDiscovery"
        private const val SERVICE_TYPE = "_coreblow._tcp."
        private const val RESCAN_INTERVAL_MS = 30_000L
        private const val ENDPOINT_EXPIRY_MS = 120_000L
        private const val RESOLVE_TIMEOUT_MS = 10_000L
    }

    private val nsdManager: NsdManager by lazy {
        context.getSystemService(Context.NSD_SERVICE) as NsdManager
    }

    private val discovered = ConcurrentHashMap<String, DiscoveredEntry>()

    private val _gateways = MutableStateFlow<List<GatewayEndpoint>>(emptyList())
    val gateways: StateFlow<List<GatewayEndpoint>> = _gateways.asStateFlow()

    private val _statusText = MutableStateFlow("Scanning…")
    val statusText: StateFlow<String> = _statusText.asStateFlow()

    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var scanJob: Job? = null
    private var expiryJob: Job? = null
    private var isScanning = false

    private data class DiscoveredEntry(
        val endpoint: GatewayEndpoint,
        val lastSeenMs: Long,
    )

    // MARK: - Lifecycle

    fun startDiscovery() {
        if (isScanning) return
        isScanning = true
        _statusText.value = "Scanning…"

        startNsdDiscovery()
        startPeriodicRescan()
        startExpiryPruner()
    }

    fun stopDiscovery() {
        isScanning = false
        scanJob?.cancel()
        expiryJob?.cancel()
        stopNsdDiscovery()
        _statusText.value = "Stopped"
    }

    fun refresh() {
        stopNsdDiscovery()
        startNsdDiscovery()
        _statusText.value = "Rescanning…"
    }

    // MARK: - NSD

    private fun startNsdDiscovery() {
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {
                Log.d(TAG, "Discovery started for $serviceType")
                _statusText.value = "Scanning…"
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "Service found: ${serviceInfo.serviceName}")
                resolveService(serviceInfo)
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "Service lost: ${serviceInfo.serviceName}")
                val stableId = serviceInfo.serviceName?.trim().orEmpty()
                if (stableId.isNotEmpty()) {
                    discovered.remove(stableId)
                    publishGateways()
                }
            }

            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "Discovery stopped")
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "Discovery start failed: $errorCode")
                _statusText.value = "Discovery failed (code $errorCode)"
                isScanning = false
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "Discovery stop failed: $errorCode")
            }
        }

        discoveryListener = listener
        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start discovery: ${e.message}")
            _statusText.value = "Discovery error"
            isScanning = false
        }
    }

    private fun stopNsdDiscovery() {
        val listener = discoveryListener ?: return
        discoveryListener = null
        try {
            nsdManager.stopServiceDiscovery(listener)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Stop discovery failed: ${e.message}")
        }
    }

    private fun resolveService(serviceInfo: NsdServiceInfo) {
        val resolveListener = object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Resolve failed for ${info.serviceName}: $errorCode")
            }

            override fun onServiceResolved(info: NsdServiceInfo) {
                val host = info.host?.hostAddress ?: return
                val port = info.port
                val name = info.serviceName?.trim().orEmpty()
                val stableId = extractStableId(info) ?: name

                if (host.isEmpty() || port <= 0) return

                val useTls = resolveTlsFromPort(port, info)
                val endpoint = GatewayEndpoint(
                    host = host,
                    port = port,
                    useTls = useTls,
                    source = DiscoverySource.BONJOUR,
                    displayName = name,
                    stableId = stableId,
                )

                Log.i(TAG, "Resolved: $name → $host:$port (tls=$useTls, stableId=$stableId)")

                discovered[stableId] = DiscoveredEntry(
                    endpoint = endpoint,
                    lastSeenMs = System.currentTimeMillis(),
                )
                publishGateways()
            }
        }

        try {
            nsdManager.resolveService(serviceInfo, resolveListener)
        } catch (e: Exception) {
            Log.w(TAG, "resolveService threw: ${e.message}")
        }
    }

    // MARK: - Helpers

    private fun extractStableId(info: NsdServiceInfo): String? {
        // Try to extract stableId from TXT record if available
        try {
            val attributes = info.attributes
            val stableIdBytes = attributes["stableId"] ?: attributes["id"]
            if (stableIdBytes != null) {
                val value = String(stableIdBytes, Charsets.UTF_8).trim()
                if (value.isNotEmpty()) return value
            }
        } catch (_: Exception) { /* TXT records may not be available */ }
        return null
    }

    private fun resolveTlsFromPort(port: Int, info: NsdServiceInfo): Boolean {
        // Check TXT record first
        try {
            val attributes = info.attributes
            val tlsBytes = attributes["tls"]
            if (tlsBytes != null) {
                val value = String(tlsBytes, Charsets.UTF_8).trim().lowercase()
                return value == "true" || value == "1" || value == "yes"
            }
        } catch (_: Exception) {}

        // Fall back to port-based heuristic
        return port == 443 || port == 8443 || port == 18790
    }

    private fun publishGateways() {
        val now = System.currentTimeMillis()
        val active = discovered.values
            .filter { now - it.lastSeenMs < ENDPOINT_EXPIRY_MS }
            .sortedByDescending { it.lastSeenMs }
            .map { it.endpoint }

        _gateways.value = active

        _statusText.value = when {
            active.isEmpty() -> "Scanning…"
            active.size == 1 -> "Found 1 gateway"
            else -> "Found ${active.size} gateways"
        }
    }

    // MARK: - Periodic Tasks

    private fun startPeriodicRescan() {
        scanJob?.cancel()
        scanJob = scope.launch {
            while (isScanning) {
                delay(RESCAN_INTERVAL_MS)
                if (!isScanning) break
                Log.d(TAG, "Periodic rescan triggered")
                stopNsdDiscovery()
                delay(500)
                if (isScanning) startNsdDiscovery()
            }
        }
    }

    private fun startExpiryPruner() {
        expiryJob?.cancel()
        expiryJob = scope.launch {
            while (isScanning) {
                delay(ENDPOINT_EXPIRY_MS / 2)
                val now = System.currentTimeMillis()
                val expired = discovered.entries.filter { now - it.value.lastSeenMs > ENDPOINT_EXPIRY_MS }
                if (expired.isNotEmpty()) {
                    expired.forEach { discovered.remove(it.key) }
                    publishGateways()
                    Log.d(TAG, "Pruned ${expired.size} expired endpoints")
                }
            }
        }
    }

    // MARK: - Network Info

    fun getLocalIpAddress(): String? {
        return try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiInfo = wifiManager.connectionInfo
            val ip = wifiInfo.ipAddress
            if (ip == 0) return null
            InetAddress.getByAddress(
                byteArrayOf(
                    (ip and 0xff).toByte(),
                    (ip shr 8 and 0xff).toByte(),
                    (ip shr 16 and 0xff).toByte(),
                    (ip shr 24 and 0xff).toByte(),
                )
            ).hostAddress
        } catch (_: Exception) { null }
    }

    fun getNetworkName(): String? {
        return try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val ssid = wifiManager.connectionInfo.ssid?.trim()?.removePrefix("\"")?.removeSuffix("\"")
            ssid?.takeIf { it.isNotEmpty() && it != "<unknown ssid>" }
        } catch (_: Exception) { null }
    }
}
