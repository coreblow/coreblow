package ai.coreblow.app.gateway

/**
 * Represents a resolved gateway endpoint that the node connects to.
 */
data class GatewayEndpoint(
    val host: String,
    val port: Int,
    val useTls: Boolean = true,
    val path: String = "/ws",
    val source: DiscoverySource = DiscoverySource.MANUAL,
    val displayName: String? = null,
) {
    /** Stable identifier for this endpoint, used to key auth tokens. */
    val stableId: String
        get() = when (source) {
            DiscoverySource.MANUAL -> "manual|$host:$port"
            DiscoverySource.BONJOUR -> "bonjour|$host:$port"
            DiscoverySource.QR_CODE -> "qr|$host:$port"
        }

    /** Full WebSocket URL for OkHttp. */
    val wsUrl: String
        get() {
            val scheme = if (useTls) "wss" else "ws"
            return "$scheme://$host:$port$path"
        }

    /** Display-friendly endpoint label. */
    val label: String
        get() = displayName ?: "$host:$port"
}

enum class DiscoverySource {
    MANUAL,
    BONJOUR,
    QR_CODE,
}
