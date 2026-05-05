package ai.coreblow.app.ui.compose

import ai.coreblow.app.gateway.DiscoverySource
import ai.coreblow.app.gateway.GatewayEndpoint

/**
 * Resolves gateway endpoint configuration from various input sources:
 * manual entry, QR code, deep link, or saved configuration.
 */
object GatewayConfigResolver {

    private val URL_PATTERN = Regex("""^(wss?|coreblow)://([^:/]+):?(\d+)?(/.*)?$""")
    private val HOST_PORT_PATTERN = Regex("""^([^:]+):(\d+)$""")

    /**
     * Resolve a user input string into a GatewayEndpoint.
     * Supports formats: "host:port", "ws://host:port/path", "coreblow://host:port"
     */
    fun resolve(input: String): GatewayEndpoint? {
        val trimmed = input.trim()
        if (trimmed.isBlank()) return null

        // Try URL format
        URL_PATTERN.matchEntire(trimmed)?.let { match ->
            val scheme = match.groupValues[1]
            val host = match.groupValues[2]
            val port = match.groupValues[3].toIntOrNull() ?: defaultPort(scheme)
            val path = match.groupValues[4].ifBlank { "/ws" }
            val useTls = scheme == "wss" || scheme == "coreblow"
            val source = if (scheme == "coreblow") DiscoverySource.QR_CODE else DiscoverySource.MANUAL

            return GatewayEndpoint(host = host, port = port, useTls = useTls, path = path, source = source)
        }

        // Try host:port format
        HOST_PORT_PATTERN.matchEntire(trimmed)?.let { match ->
            val host = match.groupValues[1]
            val port = match.groupValues[2].toInt()
            return GatewayEndpoint(host = host, port = port, useTls = port == 443 || port == 8443, source = DiscoverySource.MANUAL)
        }

        // Bare hostname — assume default port
        return GatewayEndpoint(host = trimmed, port = 8080, useTls = false, source = DiscoverySource.MANUAL)
    }

    /**
     * Parse a QR code payload into a GatewayEndpoint.
     */
    fun fromQrCode(data: String): GatewayEndpoint? {
        return resolve(data)?.copy(source = DiscoverySource.QR_CODE)
    }

    private fun defaultPort(scheme: String): Int = when (scheme) {
        "wss", "coreblow" -> 443
        else -> 8080
    }
}
