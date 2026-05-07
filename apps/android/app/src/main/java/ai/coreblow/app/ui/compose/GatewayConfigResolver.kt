package ai.coreblow.app.ui.compose

import android.content.Context
import android.util.Log
import ai.coreblow.app.SecurePrefs
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.gateway.DiscoverySource

/**
 * Resolves gateway configuration from multiple sources:
 * 1. Saved preferences (last connected gateway)
 * 2. mDNS discovery results
 * 3. Manual user input
 * 4. Deep link / intent parameters
 *
 * Provides a resolved endpoint ready for connection.
 */
class GatewayConfigResolver(
    private val appContext: Context,
    private val securePrefs: SecurePrefs,
) {
    companion object {
        private const val TAG = "GatewayConfigResolver"
    }

    /**
     * Resolve the best gateway endpoint to connect to.
     * Priority: deep link > saved prefs > first discovered.
     */
    fun resolve(
        discoveredEndpoints: List<GatewayEndpoint>,
        deepLinkHost: String? = null,
        deepLinkPort: Int? = null,
    ): GatewayEndpoint? {
        // 1. Deep link override
        if (!deepLinkHost.isNullOrBlank()) {
            val port = deepLinkPort ?: CoreBlowProtocol.DEFAULT_PORT
            Log.d(TAG, "Resolved from deep link: $deepLinkHost:$port")
            return GatewayEndpoint(
                host = deepLinkHost,
                port = port,
                useTls = port == CoreBlowProtocol.DEFAULT_TLS_PORT || port == 443,
                source = DiscoverySource.MANUAL,
                displayName = "$deepLinkHost:$port",
            )
        }

        // 2. Saved preferences
        val savedHost = securePrefs.getGatewayHost()
        val savedPort = securePrefs.getGatewayPort()
        if (!savedHost.isNullOrBlank() && savedPort != null) {
            Log.d(TAG, "Resolved from prefs: $savedHost:$savedPort")
            return GatewayEndpoint(
                host = savedHost,
                port = savedPort,
                useTls = securePrefs.getUseTls(),
                source = DiscoverySource.SAVED,
                displayName = "$savedHost:$savedPort",
            )
        }

        // 3. First discovered endpoint (prefer TLS)
        val tlsEndpoint = discoveredEndpoints.firstOrNull { it.useTls }
        if (tlsEndpoint != null) {
            Log.d(TAG, "Resolved from discovery (TLS): ${tlsEndpoint.host}:${tlsEndpoint.port}")
            return tlsEndpoint
        }

        val firstEndpoint = discoveredEndpoints.firstOrNull()
        if (firstEndpoint != null) {
            Log.d(TAG, "Resolved from discovery: ${firstEndpoint.host}:${firstEndpoint.port}")
            return firstEndpoint
        }

        Log.d(TAG, "No gateway resolved")
        return null
    }

    /**
     * Save a successfully connected endpoint for future auto-connect.
     */
    fun saveConnectedEndpoint(endpoint: GatewayEndpoint) {
        securePrefs.setGatewayHost(endpoint.host)
        securePrefs.setGatewayPort(endpoint.port)
        securePrefs.setUseTls(endpoint.useTls)
        Log.d(TAG, "Saved connected endpoint: ${endpoint.host}:${endpoint.port}")
    }

    /**
     * Clear saved gateway configuration.
     */
    fun clearSaved() {
        securePrefs.setGatewayHost("")
        securePrefs.setGatewayPort(CoreBlowProtocol.DEFAULT_PORT)
        securePrefs.setUseTls(false)
    }

    /**
     * Check if we have a saved gateway to auto-connect to.
     */
    fun hasSavedGateway(): Boolean {
        val host = securePrefs.getGatewayHost()
        return !host.isNullOrBlank()
    }
}
