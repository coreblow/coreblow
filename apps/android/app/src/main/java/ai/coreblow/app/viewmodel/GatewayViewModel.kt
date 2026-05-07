package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayDiscovery
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.gateway.GatewaySession
import ai.coreblow.app.SecurePrefs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for gateway connection management.
 * Handles discovery, manual connection, token storage,
 * and connection state bridging to Compose UI.
 */
class GatewayViewModel(application: Application) : AndroidViewModel(application) {

    private var discovery: GatewayDiscovery? = null
    private var session: GatewaySession? = null
    private var securePrefs: SecurePrefs? = null

    private val _connectionState = MutableStateFlow(GatewayConnectionState.DISCONNECTED)
    val connectionState: StateFlow<GatewayConnectionState> = _connectionState.asStateFlow()

    private val _connectedEndpoint = MutableStateFlow<GatewayEndpoint?>(null)
    val connectedEndpoint: StateFlow<GatewayEndpoint?> = _connectedEndpoint.asStateFlow()

    private val _discoveredEndpoints = MutableStateFlow<List<GatewayEndpoint>>(emptyList())
    val discoveredEndpoints: StateFlow<List<GatewayEndpoint>> = _discoveredEndpoints.asStateFlow()

    // Alias for OnboardingFlow compatibility
    val gateways: StateFlow<List<GatewayEndpoint>> = _discoveredEndpoints
    val statusText = MutableStateFlow("Idle")

    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    private val _manualHost = MutableStateFlow("")
    val manualHost: StateFlow<String> = _manualHost.asStateFlow()

    private val _manualPort = MutableStateFlow("18789")
    val manualPort: StateFlow<String> = _manualPort.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var storedToken: String? = null

    fun bindDependencies(
        disc: GatewayDiscovery,
        sess: GatewaySession,
        prefs: SecurePrefs,
    ) {
        discovery = disc
        session = sess
        securePrefs = prefs
        storedToken = prefs.getGatewayToken()

        // Bind discovery flow
        viewModelScope.launch {
            disc.gateways.collect { endpoints ->
                _discoveredEndpoints.value = endpoints
            }
        }
        viewModelScope.launch {
            disc.statusText.collect { statusText.value = it }
        }
    }

    fun startDiscovery() {
        _isScanning.value = true
        discovery?.startDiscovery()
    }

    fun stopDiscovery() {
        _isScanning.value = false
        discovery?.stopDiscovery()
    }

    fun connect(endpoint: GatewayEndpoint) {
        _connectionState.value = GatewayConnectionState.CONNECTING
        _connectedEndpoint.value = endpoint
        _errorMessage.value = null

        viewModelScope.launch {
            try {
                // Use stored token or recently set token
                val token = storedToken
                session?.connect(endpoint, buildConnectOptions(), token)
            } catch (e: Throwable) {
                _errorMessage.value = e.message ?: "Connection failed"
                _connectionState.value = GatewayConnectionState.DISCONNECTED
            }
        }
    }

    fun connectManual() {
        val host = _manualHost.value.trim()
        val port = _manualPort.value.trim().toIntOrNull() ?: 18789
        if (host.isEmpty()) {
            _errorMessage.value = "Host is required"
            return
        }

        val endpoint = GatewayEndpoint(
            host = host,
            port = port,
            useTls = port == 443 || port == 8443 || port == 18790,
            source = ai.coreblow.app.gateway.DiscoverySource.MANUAL,
            displayName = "$host:$port",
        )
        connect(endpoint)
    }

    fun connectManual(host: String, port: Int) {
        _manualHost.value = host
        _manualPort.value = port.toString()
        connectManual()
    }

    fun disconnect() {
        session?.disconnect()
        _connectionState.value = GatewayConnectionState.DISCONNECTED
        _connectedEndpoint.value = null
    }

    fun setManualHost(host: String) { _manualHost.value = host }
    fun setManualPort(port: String) { _manualPort.value = port }

    fun setToken(token: String) {
        storedToken = token.trim()
        if (storedToken!!.isNotEmpty()) {
            securePrefs?.setGatewayToken(storedToken!!)
        }
    }

    fun clearError() { _errorMessage.value = null }

    fun onConnectionStateChanged(state: GatewayConnectionState) {
        _connectionState.value = state
        if (state == GatewayConnectionState.DISCONNECTED) {
            _connectedEndpoint.value = null
        }
    }

    private fun buildConnectOptions(): ai.coreblow.app.gateway.GatewayConnectOptions {
        return ai.coreblow.app.gateway.GatewayConnectOptions(
            role = "node",
            scopes = listOf("chat", "invoke", "canvas"),
            capabilities = listOf("camera", "location", "sms", "contacts", "calendar", "photos", "motion", "tts"),
            commands = listOf("device.info", "device.battery", "camera.capture", "location.current", "sms.read", "sms.send", "contacts.list", "calendar.events", "photos.recent", "motion.read"),
            permissions = mapOf("camera" to true, "microphone" to true, "location" to true, "sms" to true, "contacts" to true, "calendar" to true),
            client = ai.coreblow.app.gateway.GatewayClientInfo(
                id = securePrefs?.getDeviceId() ?: "android-unknown",
                displayName = android.os.Build.MODEL,
                version = "1.0.0",
                platform = "android",
                mode = "node",
                instanceId = securePrefs?.getInstanceId(),
                deviceFamily = "phone",
                modelIdentifier = android.os.Build.MODEL,
            ),
        )
    }
}
