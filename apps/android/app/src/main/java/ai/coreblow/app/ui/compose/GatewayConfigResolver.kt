package ai.coreblow.app.ui.compose

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.gateway.EndpointDeduplicator

/**
 * Resolves gateway configuration by combining multiple sources:
 * mDNS/Bonjour discovery, manual entry, saved preferences,
 * deep link URIs, and QR code scanning.
 */
class GatewayConfigResolver(private val context: Context) {

    companion object {
        private const val TAG = "GatewayConfigResolver"
        private const val NSD_SERVICE_TYPE = "_coreblow._tcp."
        private const val DISCOVERY_TIMEOUT_MS = 10_000L
    }

    private val _discoveredEndpoints = MutableStateFlow<List<GatewayEndpoint>>(emptyList())
    val discoveredEndpoints: StateFlow<List<GatewayEndpoint>> = _discoveredEndpoints.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    private var nsdManager: NsdManager? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var discoveryJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Start mDNS discovery for gateway services.
     */
    fun startDiscovery() {
        if (_isDiscovering.value) return

        _isDiscovering.value = true
        _lastError.value = null

        try {
            nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

            discoveryListener = object : NsdManager.DiscoveryListener {
                override fun onDiscoveryStarted(serviceType: String) {
                    Log.i(TAG, "mDNS discovery started")
                }

                override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                    Log.d(TAG, "Service found: ${serviceInfo.serviceName}")
                    resolveService(serviceInfo)
                }

                override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                    Log.d(TAG, "Service lost: ${serviceInfo.serviceName}")
                    removeEndpoint(serviceInfo.serviceName)
                }

                override fun onDiscoveryStopped(serviceType: String) {
                    Log.i(TAG, "mDNS discovery stopped")
                    _isDiscovering.value = false
                }

                override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                    _lastError.value = "Discovery failed (code=$errorCode)"
                    _isDiscovering.value = false
                }

                override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                    Log.w(TAG, "Stop discovery failed: $errorCode")
                }
            }

            nsdManager?.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)

            // Auto-stop after timeout
            discoveryJob = scope.launch {
                delay(DISCOVERY_TIMEOUT_MS)
                stopDiscovery()
            }
        } catch (e: Exception) {
            _lastError.value = "Discovery error: ${e.message}"
            _isDiscovering.value = false
        }
    }

    /**
     * Stop mDNS discovery.
     */
    fun stopDiscovery() {
        discoveryJob?.cancel()
        try {
            discoveryListener?.let { nsdManager?.stopServiceDiscovery(it) }
        } catch (_: Exception) {}
        discoveryListener = null
        _isDiscovering.value = false
    }

    /**
     * Add an endpoint from manual entry.
     */
    fun addManualEndpoint(host: String, port: Int = 18789, secure: Boolean = false) {
        val endpoint = GatewayEndpoint.fromManual(host, port, secure)
        mergeEndpoint(endpoint)
    }

    /**
     * Add an endpoint from a deep link URI.
     */
    fun addFromDeepLink(uri: String) {
        try {
            val parsed = android.net.Uri.parse(uri)
            val host = parsed.host ?: return
            val port = parsed.port.takeIf { it > 0 } ?: 18789
            val token = parsed.getQueryParameter("token")
            mergeEndpoint(GatewayEndpoint.fromDeepLink(host, port, token))
        } catch (e: Exception) {
            _lastError.value = "Invalid deep link: ${e.message}"
        }
    }

    /**
     * Add an endpoint from QR code data.
     */
    fun addFromQrCode(data: String) {
        if (data.startsWith("coreblow://") || data.startsWith("http")) {
            addFromDeepLink(data)
        } else {
            // Try host:port format
            val parts = data.split(":")
            if (parts.size == 2) {
                val host = parts[0].trim()
                val port = parts[1].trim().toIntOrNull() ?: 18789
                addManualEndpoint(host, port)
            } else if (parts.size == 1 && parts[0].isNotBlank()) {
                addManualEndpoint(parts[0].trim())
            } else {
                _lastError.value = "Invalid QR code data"
            }
        }
    }

    /**
     * Load saved endpoints from preferences.
     */
    fun loadSavedEndpoints() {
        val prefs = context.getSharedPreferences("coreblow_endpoints", Context.MODE_PRIVATE)
        val json = prefs.getString("saved_endpoints", null) ?: return

        try {
            val array = kotlinx.serialization.json.Json.parseToJsonElement(json).jsonArray
            val endpoints = array.mapNotNull { elem ->
                val obj = elem.jsonObject
                val host = obj["host"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val port = obj["port"]?.jsonPrimitive?.intOrNull ?: 18789
                val name = obj["name"]?.jsonPrimitive?.contentOrNull
                val secure = obj["secure"]?.jsonPrimitive?.booleanOrNull ?: false
                GatewayEndpoint.fromSaved(host, port, name, secure)
            }
            _discoveredEndpoints.value = EndpointDeduplicator.merge(_discoveredEndpoints.value, endpoints)
        } catch (_: Exception) {}
    }

    /**
     * Save current endpoints to preferences.
     */
    fun saveEndpoints() {
        val json = kotlinx.serialization.json.buildJsonArray {
            _discoveredEndpoints.value.forEach { ep ->
                add(kotlinx.serialization.json.buildJsonObject {
                    put("host", ep.host)
                    put("port", ep.port)
                    put("name", ep.displayName)
                    put("secure", ep.isSecure)
                })
            }
        }.toString()

        context.getSharedPreferences("coreblow_endpoints", Context.MODE_PRIVATE)
            .edit().putString("saved_endpoints", json).apply()
    }

    /**
     * Remove an endpoint.
     */
    fun removeEndpoint(identityKey: String) {
        _discoveredEndpoints.value = _discoveredEndpoints.value.filter { it.identityKey != identityKey }
    }

    /**
     * Get the best available endpoint (most recent, local preferred).
     */
    fun getBestEndpoint(): GatewayEndpoint? {
        val endpoints = _discoveredEndpoints.value
        return endpoints.firstOrNull { it.isLocal }
            ?: endpoints.firstOrNull()
    }

    /**
     * Clear all discovered endpoints.
     */
    fun clearAll() {
        _discoveredEndpoints.value = emptyList()
    }

    fun clearError() { _lastError.value = null }

    fun release() {
        stopDiscovery()
        scope.cancel()
    }

    // MARK: - Private

    private fun resolveService(serviceInfo: NsdServiceInfo) {
        nsdManager?.resolveService(serviceInfo, object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Resolve failed: ${info.serviceName} (code=$errorCode)")
            }

            override fun onServiceResolved(info: NsdServiceInfo) {
                val endpoint = GatewayEndpoint.fromNsd(info)
                if (endpoint != null) {
                    Log.i(TAG, "Resolved: ${endpoint.displayName} at ${endpoint.host}:${endpoint.port}")
                    mergeEndpoint(endpoint)
                }
            }
        })
    }

    private fun mergeEndpoint(endpoint: GatewayEndpoint) {
        _discoveredEndpoints.value = EndpointDeduplicator.merge(_discoveredEndpoints.value, listOf(endpoint))
    }

    private fun removeEndpoint(serviceName: String) {
        _discoveredEndpoints.value = _discoveredEndpoints.value.filter { it.displayName != serviceName }
    }
}
