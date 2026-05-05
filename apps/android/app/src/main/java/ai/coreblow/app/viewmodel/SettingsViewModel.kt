package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import ai.coreblow.app.voice.VoiceWakePreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Settings ViewModel with gateway and voice wake configuration.
 */
class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    val isLoading = MutableStateFlow(false)

    private val voicePrefs = VoiceWakePreferences(application)

    /** Voice wake enabled toggle. */
    private val _voiceWakeEnabled = MutableStateFlow(voicePrefs.isEnabled)
    val voiceWakeEnabled: StateFlow<Boolean> = _voiceWakeEnabled.asStateFlow()

    /** Wake phrase. */
    private val _wakePhrase = MutableStateFlow(voicePrefs.wakePhrase)
    val wakePhrase: StateFlow<String> = _wakePhrase.asStateFlow()

    /** Wake sensitivity. */
    private val _wakeSensitivity = MutableStateFlow(voicePrefs.sensitivity)
    val wakeSensitivity: StateFlow<Float> = _wakeSensitivity.asStateFlow()

    /** Haptic feedback on wake. */
    private val _hapticFeedback = MutableStateFlow(voicePrefs.hapticFeedback)
    val hapticFeedback: StateFlow<Boolean> = _hapticFeedback.asStateFlow()

    fun setVoiceWakeEnabled(enabled: Boolean) {
        voicePrefs.isEnabled = enabled
        _voiceWakeEnabled.value = enabled
    }

    fun setWakePhrase(phrase: String) {
        voicePrefs.wakePhrase = phrase
        _wakePhrase.value = voicePrefs.wakePhrase
    }

    fun setWakeSensitivity(sensitivity: Float) {
        voicePrefs.sensitivity = sensitivity
        _wakeSensitivity.value = voicePrefs.sensitivity
    }

    fun setHapticFeedback(enabled: Boolean) {
        voicePrefs.hapticFeedback = enabled
        _hapticFeedback.value = enabled
    }
}
