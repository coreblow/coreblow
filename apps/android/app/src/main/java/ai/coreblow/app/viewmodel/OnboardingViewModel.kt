package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import ai.coreblow.app.gateway.DiscoverySource
import ai.coreblow.app.gateway.GatewayEndpoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Onboarding ViewModel with gateway setup wizard integration.
 */
class OnboardingViewModel(application: Application) : AndroidViewModel(application) {

    val isLoading = MutableStateFlow(false)

    /** Current onboarding step. */
    private val _currentStep = MutableStateFlow(OnboardingStep.WELCOME)
    val currentStep: StateFlow<OnboardingStep> = _currentStep.asStateFlow()

    /** Whether gateway setup was completed during onboarding. */
    private val _gatewayConfigured = MutableStateFlow(false)
    val gatewayConfigured: StateFlow<Boolean> = _gatewayConfigured.asStateFlow()

    /** Setup code entered by user for QR pairing. */
    private val _setupCode = MutableStateFlow("")
    val setupCode: StateFlow<String> = _setupCode.asStateFlow()

    fun nextStep() {
        _currentStep.value = when (_currentStep.value) {
            OnboardingStep.WELCOME -> OnboardingStep.PERMISSIONS
            OnboardingStep.PERMISSIONS -> OnboardingStep.GATEWAY_SETUP
            OnboardingStep.GATEWAY_SETUP -> OnboardingStep.COMPLETE
            OnboardingStep.COMPLETE -> OnboardingStep.COMPLETE
        }
    }

    fun previousStep() {
        _currentStep.value = when (_currentStep.value) {
            OnboardingStep.COMPLETE -> OnboardingStep.GATEWAY_SETUP
            OnboardingStep.GATEWAY_SETUP -> OnboardingStep.PERMISSIONS
            OnboardingStep.PERMISSIONS -> OnboardingStep.WELCOME
            OnboardingStep.WELCOME -> OnboardingStep.WELCOME
        }
    }

    fun setSetupCode(code: String) { _setupCode.value = code }

    fun skipGatewaySetup() {
        _gatewayConfigured.value = false
        nextStep()
    }

    fun completeGatewaySetup() {
        _gatewayConfigured.value = true
        nextStep()
    }

    /**
     * Parse a QR code into a gateway endpoint.
     * Expected format: coreblow://host:port
     */
    fun parseQrCode(qrData: String): GatewayEndpoint? {
        val regex = Regex("""coreblow://([^:]+):(\d+)""")
        val match = regex.matchEntire(qrData) ?: return null
        return GatewayEndpoint(
            host = match.groupValues[1],
            port = match.groupValues[2].toInt(),
            source = DiscoverySource.QR_CODE,
        )
    }
}

enum class OnboardingStep {
    WELCOME,
    PERMISSIONS,
    GATEWAY_SETUP,
    COMPLETE,
}
