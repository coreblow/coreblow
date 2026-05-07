package ai.coreblow.app.gateway

import android.net.nsd.NsdServiceInfo
import android.util.Log

/**
 * Represents a discovered or manually configured gateway endpoint.
 */
data class GatewayEndpoint(
    val host: String,
    val port: Int,
    val displayName: String = "",
    val instanceId: String? = null,
    val protocolVersion: String? = null,
    val isSecure: Boolean = false,
    val tlsFingerprint: String? = null,
    val source: DiscoverySource = DiscoverySource.MANUAL,
    val discoveredAt: Long = System.currentTimeMillis(),
    val lastSeenAt: Long = System.currentTimeMillis(),
    val metadata: Map<String, String> = emptyMap(),
) {
    companion object {
        private const val TAG = "GatewayEndpoint"

        /**
         * Create from mDNS NsdServiceInfo.
         */
        fun fromNsd(info: NsdServiceInfo): GatewayEndpoint? {
            val host = info.host?.hostAddress ?: return null
            val port = info.port
            if (port <= 0) return null

            val txtRecords = mutableMapOf<String, String>()
            try {
                val attrs = info.attributes
                for ((key, value) in attrs) {
                    txtRecords[key] = value?.let { String(it) } ?: "true"
                }
            } catch (_: Throwable) {}

            val name = txtRecords["name"]
                ?: info.serviceName
                ?: "$host:$port"

            return GatewayEndpoint(
                host = host,
                port = port,
                displayName = BonjourEscapes.unescapeValue(name),
                instanceId = txtRecords["id"] ?: txtRecords["instanceId"],
                protocolVersion = txtRecords["version"] ?: txtRecords["proto"],
                isSecure = BonjourEscapes.getBool(txtRecords, "tls"),
                tlsFingerprint = txtRecords["fingerprint"],
                source = DiscoverySource.MDNS,
                metadata = txtRecords,
            )
        }

        /**
         * Create from a manual host:port input.
         */
        fun fromManual(host: String, port: Int = 18789, secure: Boolean = false): GatewayEndpoint {
            return GatewayEndpoint(
                host = host.trim(),
                port = port,
                displayName = "$host:$port",
                isSecure = secure,
                source = DiscoverySource.MANUAL,
            )
        }

        /**
         * Create from a deep link URI.
         */
        fun fromDeepLink(host: String, port: Int = 18789, token: String? = null): GatewayEndpoint {
            return GatewayEndpoint(
                host = host.trim(),
                port = port,
                displayName = "$host:$port",
                source = DiscoverySource.DEEP_LINK,
                metadata = if (token != null) mapOf("token" to token) else emptyMap(),
            )
        }

        /**
         * Create from saved preferences.
         */
        fun fromSaved(host: String, port: Int, name: String? = null, secure: Boolean = false): GatewayEndpoint {
            return GatewayEndpoint(
                host = host,
                port = port,
                displayName = name ?: "$host:$port",
                isSecure = secure,
                source = DiscoverySource.SAVED,
            )
        }
    }

    /** WebSocket URL for this endpoint. */
    val wsUrl: String get() {
        val scheme = if (isSecure) "wss" else "ws"
        return "$scheme://$host:$port/ws"
    }

    /** HTTP base URL for this endpoint. */
    val httpUrl: String get() {
        val scheme = if (isSecure) "https" else "http"
        return "$scheme://$host:$port"
    }

    /** Unique identity key for deduplication. */
    val identityKey: String get() = "$host:$port"

    /** Check if this endpoint is likely on the local network. */
    val isLocal: Boolean get() {
        return host.startsWith("192.168.") ||
            host.startsWith("10.") ||
            host.startsWith("172.") ||
            host == "localhost" ||
            host == "127.0.0.1"
    }

    /** Human-readable status label. */
    val sourceLabel: String get() = when (source) {
        DiscoverySource.MDNS -> "Discovered"
        DiscoverySource.MANUAL -> "Manual"
        DiscoverySource.DEEP_LINK -> "Link"
        DiscoverySource.SAVED -> "Saved"
        DiscoverySource.QR_CODE -> "QR Code"
    }

    /** Formatted age since discovery. */
    fun ageSinceDiscovery(): String {
        val diffMs = System.currentTimeMillis() - discoveredAt
        val seconds = diffMs / 1000
        val minutes = seconds / 60
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            else -> "${minutes / 60}h ago"
        }
    }
}

/**
 * How this endpoint was discovered.
 */
enum class DiscoverySource {
    MDNS, MANUAL, DEEP_LINK, SAVED, QR_CODE,
}

/**
 * Deduplicates gateway endpoints by host:port identity.
 */
object EndpointDeduplicator {
    fun deduplicate(endpoints: List<GatewayEndpoint>): List<GatewayEndpoint> {
        val seen = mutableSetOf<String>()
        return endpoints.filter { ep ->
            val key = ep.identityKey
            if (key in seen) false
            else { seen.add(key); true }
        }
    }

    fun merge(existing: List<GatewayEndpoint>, incoming: List<GatewayEndpoint>): List<GatewayEndpoint> {
        val merged = existing.toMutableList()
        for (ep in incoming) {
            val idx = merged.indexOfFirst { it.identityKey == ep.identityKey }
            if (idx >= 0) {
                merged[idx] = ep.copy(
                    lastSeenAt = System.currentTimeMillis(),
                    displayName = ep.displayName.ifBlank { merged[idx].displayName },
                )
            } else {
                merged.add(ep)
            }
        }
        return merged
    }
}
