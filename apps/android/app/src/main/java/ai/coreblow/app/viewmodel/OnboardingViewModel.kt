package ai.coreblow.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel for the onboarding flow.
 * Manages multi-step wizard state, gateway connection setup,
 * permission grants, and preference initialization.
 */
class OnboardingViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "OnboardingVM"
        const val TOTAL_STEPS = 5
    }

    // Step tracking
    private val _currentStep = MutableStateFlow(0)
    val currentStep: StateFlow<Int> = _currentStep.asStateFlow()

    private val _completedSteps = MutableStateFlow<Set<Int>>(emptySet())
    val completedSteps: StateFlow<Set<Int>> = _completedSteps.asStateFlow()

    // Gateway setup
    private val _gatewayHost = MutableStateFlow("")
    val gatewayHost: StateFlow<String> = _gatewayHost.asStateFlow()

    private val _gatewayPort = MutableStateFlow("18789")
    val gatewayPort: StateFlow<String> = _gatewayPort.asStateFlow()

    private val _useTls = MutableStateFlow(false)
    val useTls: StateFlow<Boolean> = _useTls.asStateFlow()

    private val _isTestingConnection = MutableStateFlow(false)
    val isTestingConnection: StateFlow<Boolean> = _isTestingConnection.asStateFlow()

    private val _connectionTestResult = MutableStateFlow<ConnectionTestResult?>(null)
    val connectionTestResult: StateFlow<ConnectionTestResult?> = _connectionTestResult.asStateFlow()

    // Permissions
    private val _permissionsGranted = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val permissionsGranted: StateFlow<Map<String, Boolean>> = _permissionsGranted.asStateFlow()

    // User preferences
    private val _displayName = MutableStateFlow("")
    val displayName: StateFlow<String> = _displayName.asStateFlow()

    private val _theme = MutableStateFlow("system")
    val theme: StateFlow<String> = _theme.asStateFlow()

    private val _enableVoice = MutableStateFlow(true)
    val enableVoice: StateFlow<Boolean> = _enableVoice.asStateFlow()

    private val _enableNotifications = MutableStateFlow(true)
    val enableNotifications: StateFlow<Boolean> = _enableNotifications.asStateFlow()

    // Capabilities to enable
    private val _selectedCapabilities = MutableStateFlow<Set<String>>(setOf("camera", "location", "contacts"))
    val selectedCapabilities: StateFlow<Set<String>> = _selectedCapabilities.asStateFlow()

    // Error/loading
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Derived state
    val progress = _currentStep.map { (it + 1).toFloat() / TOTAL_STEPS }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.2f)

    val canGoNext = combine(_currentStep, _gatewayHost, _connectionTestResult, _displayName) { step, host, testResult, name ->
        when (step) {
            0 -> true // Welcome
            1 -> host.isNotBlank() && (testResult?.isSuccess == true) // Gateway
            2 -> true // Permissions (optional)
            3 -> name.isNotBlank() // Profile
            4 -> true // Finish
            else -> false
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    val isFirstStep = _currentStep.map { it == 0 }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)
    val isLastStep = _currentStep.map { it == TOTAL_STEPS - 1 }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val stepTitle = _currentStep.map { step ->
        when (step) {
            0 -> "Welcome to CoreBlow"
            1 -> "Connect Gateway"
            2 -> "Permissions"
            3 -> "Your Profile"
            4 -> "Ready to Go!"
            else -> ""
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Welcome to CoreBlow")

    val stepDescription = _currentStep.map { step ->
        when (step) {
            0 -> "CoreBlow connects your Android device to AI agents via a local gateway."
            1 -> "Enter your gateway address to connect."
            2 -> "Grant permissions to enable device capabilities."
            3 -> "Set up your profile and preferences."
            4 -> "You're all set! Start chatting with your AI assistant."
            else -> ""
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    // Actions
    fun nextStep() {
        val current = _currentStep.value
        _completedSteps.value = _completedSteps.value + current
        if (current < TOTAL_STEPS - 1) _currentStep.value = current + 1
    }

    fun previousStep() {
        val current = _currentStep.value
        if (current > 0) _currentStep.value = current - 1
    }

    fun goToStep(step: Int) {
        if (step in 0 until TOTAL_STEPS) _currentStep.value = step
    }

    fun setGatewayHost(host: String) {
        _gatewayHost.value = host.trim()
        _connectionTestResult.value = null
    }

    fun setGatewayPort(port: String) {
        _gatewayPort.value = port.filter { it.isDigit() }
        _connectionTestResult.value = null
    }

    fun setUseTls(tls: Boolean) {
        _useTls.value = tls
        _connectionTestResult.value = null
    }

    fun testConnection() {
        val host = _gatewayHost.value
        if (host.isBlank()) {
            _error.value = "Host is required"
            return
        }

        _isTestingConnection.value = true
        _connectionTestResult.value = null
        _error.value = null

        viewModelScope.launch {
            try {
                delay(2000) // Simulate connection test
                val port = _gatewayPort.value.toIntOrNull() ?: 18789
                Log.i(TAG, "Testing connection to $host:$port")
                _connectionTestResult.value = ConnectionTestResult(
                    isSuccess = true,
                    latencyMs = 42,
                    gatewayVersion = "1.0.0",
                    message = "Connected successfully",
                )
            } catch (e: Exception) {
                _connectionTestResult.value = ConnectionTestResult(
                    isSuccess = false,
                    message = "Connection failed: ${e.message}",
                )
            } finally {
                _isTestingConnection.value = false
            }
        }
    }

    fun setDisplayName(name: String) { _displayName.value = name }
    fun setTheme(theme: String) { _theme.value = theme }
    fun setEnableVoice(enabled: Boolean) { _enableVoice.value = enabled }
    fun setEnableNotifications(enabled: Boolean) { _enableNotifications.value = enabled }

    fun toggleCapability(cap: String) {
        val current = _selectedCapabilities.value.toMutableSet()
        if (cap in current) current.remove(cap) else current.add(cap)
        _selectedCapabilities.value = current
    }

    fun setPermissionResult(permission: String, granted: Boolean) {
        _permissionsGranted.value = _permissionsGranted.value + (permission to granted)
    }

    fun clearError() { _error.value = null }

    fun finishOnboarding(): OnboardingResult {
        return OnboardingResult(
            gatewayHost = _gatewayHost.value,
            gatewayPort = _gatewayPort.value.toIntOrNull() ?: 18789,
            useTls = _useTls.value,
            displayName = _displayName.value,
            theme = _theme.value,
            enableVoice = _enableVoice.value,
            enableNotifications = _enableNotifications.value,
            capabilities = _selectedCapabilities.value,
        )
    }

    data class ConnectionTestResult(
        val isSuccess: Boolean,
        val latencyMs: Int = 0,
        val gatewayVersion: String? = null,
        val message: String,
    )

    data class OnboardingResult(
        val gatewayHost: String,
        val gatewayPort: Int,
        val useTls: Boolean,
        val displayName: String,
        val theme: String,
        val enableVoice: Boolean,
        val enableNotifications: Boolean,
        val capabilities: Set<String>,
    )
}
