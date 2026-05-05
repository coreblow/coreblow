package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.gateway.DiscoverySource
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayDiscovery
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.node.ConnectionManager
import ai.coreblow.app.node.NodeRuntimeFlags
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for gateway connection state, pairing flow, and endpoint management.
 *
 * Used by ConnectScreen, OnboardingScreen, and SettingsScreen.
 */
class GatewayViewModel(application: Application) : AndroidViewModel(application) {

    private val connectionManager = ConnectionManager(application, viewModelScope)
    private val discovery = GatewayDiscovery(application)

    /** Current connection state. */
    val connectionState: StateFlow<GatewayConnectionState> = connectionManager.connectionState

    /** Currently connected endpoint. */
    val connectedEndpoint: StateFlow<GatewayEndpoint?> = connectionManager.connectedEndpoint

    /** Discovered gateway endpoints on the local network. */
    private val _discoveredEndpoints = MutableStateFlow<List<GatewayEndpoint>>(emptyList())
    val discoveredEndpoints: StateFlow<List<GatewayEndpoint>> = _discoveredEndpoints.asStateFlow()

    /** Manual endpoint input state. */
    private val _manualHost = MutableStateFlow("")
    val manualHost: StateFlow<String> = _manualHost.asStateFlow()

    private val _manualPort = MutableStateFlow("8080")
    val manualPort: StateFlow<String> = _manualPort.asStateFlow()

    /** Error state. */
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    /** Whether discovery scan is active. */
    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    /**
     * Update runtime permission flags before connecting.
     */
    fun updateRuntimeFlags(flags: NodeRuntimeFlags) {
        connectionManager.runtimeFlags = flags
    }

    /**
     * Connect to a gateway endpoint.
     */
    fun connect(endpoint: GatewayEndpoint) {
        _errorMessage.value = null
        connectionManager.connect(endpoint)
    }

    /**
     * Connect using manual host/port input.
     */
    fun connectManual() {
        val host = _manualHost.value.trim()
        val port = _manualPort.value.trim().toIntOrNull() ?: 8080

        if (host.isBlank()) {
            _errorMessage.value = "Host cannot be empty"
            return
        }

        val endpoint = GatewayEndpoint(
            host = host,
            port = port,
            useTls = port == 443 || port == 8443,
            source = DiscoverySource.MANUAL,
        )

        connect(endpoint)
    }

    /**
     * Disconnect from the current gateway.
     */
    fun disconnect() {
        connectionManager.disconnect()
    }

    /**
     * Unpair and remove auth token for an endpoint.
     */
    fun unpair(endpoint: GatewayEndpoint) {
        connectionManager.unpair(endpoint)
    }

    /**
     * Start scanning for gateway endpoints on the local network.
     */
    fun startDiscovery() {
        _isScanning.value = true
        _discoveredEndpoints.value = emptyList()

        viewModelScope.launch {
            discovery.discover().collect { endpoint ->
                val current = _discoveredEndpoints.value.toMutableList()
                if (current.none { it.stableId == endpoint.stableId }) {
                    current.add(endpoint)
                    _discoveredEndpoints.value = current
                }
            }
        }
    }

    /**
     * Stop scanning for gateway endpoints.
     */
    fun stopDiscovery() {
        _isScanning.value = false
    }

    fun setManualHost(host: String) { _manualHost.value = host }
    fun setManualPort(port: String) { _manualPort.value = port }
    fun clearError() { _errorMessage.value = null }
}
