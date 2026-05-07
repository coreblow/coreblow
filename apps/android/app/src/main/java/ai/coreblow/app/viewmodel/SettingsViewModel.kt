package ai.coreblow.app.viewmodel

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import ai.coreblow.app.SecurePrefs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * ViewModel for the Settings sheet.
 * Manages gateway config, device capability toggles, debug info,
 * and preference persistence via SecurePrefs.
 */
class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private var securePrefs: SecurePrefs? = null

    // Gateway
    private val _gatewayHost = MutableStateFlow("")
    val gatewayHost: StateFlow<String> = _gatewayHost.asStateFlow()

    private val _gatewayPort = MutableStateFlow("18789")
    val gatewayPort: StateFlow<String> = _gatewayPort.asStateFlow()

    private val _gatewayToken = MutableStateFlow("")
    val gatewayToken: StateFlow<String> = _gatewayToken.asStateFlow()

    private val _useTls = MutableStateFlow(false)
    val useTls: StateFlow<Boolean> = _useTls.asStateFlow()

    // Capabilities
    private val _cameraEnabled = MutableStateFlow(true)
    val cameraEnabled: StateFlow<Boolean> = _cameraEnabled.asStateFlow()

    private val _locationEnabled = MutableStateFlow(true)
    val locationEnabled: StateFlow<Boolean> = _locationEnabled.asStateFlow()

    private val _smsEnabled = MutableStateFlow(true)
    val smsEnabled: StateFlow<Boolean> = _smsEnabled.asStateFlow()

    private val _contactsEnabled = MutableStateFlow(true)
    val contactsEnabled: StateFlow<Boolean> = _contactsEnabled.asStateFlow()

    private val _calendarEnabled = MutableStateFlow(true)
    val calendarEnabled: StateFlow<Boolean> = _calendarEnabled.asStateFlow()

    private val _micEnabled = MutableStateFlow(true)
    val micEnabled: StateFlow<Boolean> = _micEnabled.asStateFlow()

    private val _motionEnabled = MutableStateFlow(true)
    val motionEnabled: StateFlow<Boolean> = _motionEnabled.asStateFlow()

    // Debug
    private val _debugMode = MutableStateFlow(false)
    val debugMode: StateFlow<Boolean> = _debugMode.asStateFlow()

    private val _deviceId = MutableStateFlow("")
    val deviceId: StateFlow<String> = _deviceId.asStateFlow()

    private val _appVersion = MutableStateFlow("1.0.0")
    val appVersion: StateFlow<String> = _appVersion.asStateFlow()

    private val _deviceModel = MutableStateFlow(Build.MODEL)
    val deviceModel: StateFlow<String> = _deviceModel.asStateFlow()

    fun bindPrefs(prefs: SecurePrefs) {
        securePrefs = prefs
        _gatewayHost.value = prefs.getGatewayHost() ?: ""
        _gatewayPort.value = prefs.getGatewayPort()?.toString() ?: "18789"
        _gatewayToken.value = if (prefs.getGatewayToken() != null) "••••••••" else ""
        _useTls.value = prefs.getUseTls()
        _deviceId.value = prefs.getDeviceId() ?: "unknown"
        _debugMode.value = prefs.getDebugMode()

        // Load capability toggles
        _cameraEnabled.value = prefs.getCapability("camera")
        _locationEnabled.value = prefs.getCapability("location")
        _smsEnabled.value = prefs.getCapability("sms")
        _contactsEnabled.value = prefs.getCapability("contacts")
        _calendarEnabled.value = prefs.getCapability("calendar")
        _micEnabled.value = prefs.getCapability("microphone")
        _motionEnabled.value = prefs.getCapability("motion")
    }

    fun setGatewayHost(host: String) {
        _gatewayHost.value = host
        securePrefs?.setGatewayHost(host.trim())
    }

    fun setGatewayPort(port: String) {
        _gatewayPort.value = port
        port.trim().toIntOrNull()?.let { securePrefs?.setGatewayPort(it) }
    }

    fun setGatewayToken(token: String) {
        securePrefs?.setGatewayToken(token.trim())
        _gatewayToken.value = if (token.isNotBlank()) "••••••••" else ""
    }

    fun setUseTls(enabled: Boolean) {
        _useTls.value = enabled
        securePrefs?.setUseTls(enabled)
    }

    fun setCapability(name: String, enabled: Boolean) {
        securePrefs?.setCapability(name, enabled)
        when (name) {
            "camera" -> _cameraEnabled.value = enabled
            "location" -> _locationEnabled.value = enabled
            "sms" -> _smsEnabled.value = enabled
            "contacts" -> _contactsEnabled.value = enabled
            "calendar" -> _calendarEnabled.value = enabled
            "microphone" -> _micEnabled.value = enabled
            "motion" -> _motionEnabled.value = enabled
        }
    }

    fun setDebugMode(enabled: Boolean) {
        _debugMode.value = enabled
        securePrefs?.setDebugMode(enabled)
    }

    fun clearAllData() {
        securePrefs?.clearAll()
        _gatewayHost.value = ""
        _gatewayPort.value = "18789"
        _gatewayToken.value = ""
        _useTls.value = false
        _debugMode.value = false
    }

    fun getEnabledCapabilities(): List<String> {
        val caps = mutableListOf<String>()
        if (_cameraEnabled.value) caps.add("camera")
        if (_locationEnabled.value) caps.add("location")
        if (_smsEnabled.value) caps.add("sms")
        if (_contactsEnabled.value) caps.add("contacts")
        if (_calendarEnabled.value) caps.add("calendar")
        if (_micEnabled.value) caps.add("microphone")
        if (_motionEnabled.value) caps.add("motion")
        return caps
    }
}
