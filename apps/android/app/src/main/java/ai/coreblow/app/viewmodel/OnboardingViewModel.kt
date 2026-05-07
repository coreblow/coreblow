package ai.coreblow.app.viewmodel

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Onboarding wizard steps.
 */
enum class OnboardingStep {
    WELCOME,
    PERMISSIONS,
    GATEWAY_SETUP,
    COMPLETE,
}

/**
 * ViewModel for the onboarding wizard.
 * Tracks step progression, permission status, and gateway setup state.
 */
class OnboardingViewModel(application: Application) : AndroidViewModel(application) {

    private val _currentStep = MutableStateFlow(OnboardingStep.WELCOME)
    val currentStep: StateFlow<OnboardingStep> = _currentStep.asStateFlow()

    private val _isCompleted = MutableStateFlow(false)
    val isCompleted: StateFlow<Boolean> = _isCompleted.asStateFlow()

    private val _permissionsGranted = MutableStateFlow(false)
    val permissionsGranted: StateFlow<Boolean> = _permissionsGranted.asStateFlow()

    private val _gatewayConfigured = MutableStateFlow(false)
    val gatewayConfigured: StateFlow<Boolean> = _gatewayConfigured.asStateFlow()

    private val prefs = application.getSharedPreferences("coreblow_onboarding", Context.MODE_PRIVATE)

    init {
        _isCompleted.value = prefs.getBoolean("onboarding_completed", false)
        checkPermissions()
    }

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
            OnboardingStep.WELCOME -> OnboardingStep.WELCOME
            OnboardingStep.PERMISSIONS -> OnboardingStep.WELCOME
            OnboardingStep.GATEWAY_SETUP -> OnboardingStep.PERMISSIONS
            OnboardingStep.COMPLETE -> OnboardingStep.GATEWAY_SETUP
        }
    }

    fun goToStep(step: OnboardingStep) {
        _currentStep.value = step
    }

    fun skipGatewaySetup() {
        _currentStep.value = OnboardingStep.COMPLETE
    }

    fun completeGatewaySetup() {
        _gatewayConfigured.value = true
        _currentStep.value = OnboardingStep.COMPLETE
    }

    fun completeOnboarding() {
        _isCompleted.value = true
        prefs.edit().putBoolean("onboarding_completed", true).apply()
    }

    fun resetOnboarding() {
        _isCompleted.value = false
        _currentStep.value = OnboardingStep.WELCOME
        _gatewayConfigured.value = false
        prefs.edit().putBoolean("onboarding_completed", false).apply()
    }

    fun checkPermissions() {
        val context = getApplication<Application>()
        val required = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            required.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        _permissionsGranted.value = required.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun onPermissionsResult() {
        checkPermissions()
    }

    fun getMissingPermissions(): List<String> {
        val context = getApplication<Application>()
        val required = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            required.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return required.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
    }
}
