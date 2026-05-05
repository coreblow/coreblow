package ai.coreblow.app.voice

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * State of the wake word detection system.
 */
enum class WakeState {
    IDLE,
    LISTENING,
    DETECTED,
    COOLDOWN,
}

/**
 * Manages wake word detection from continuous microphone input.
 *
 * Listens for the configured wake phrase and transitions through
 * IDLE → LISTENING → DETECTED → COOLDOWN states.
 */
class VoiceWakeManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val preferences: VoiceWakePreferences,
    private val onWakeDetected: () -> Unit,
) {
    companion object {
        private const val TAG = "VoiceWakeManager"
    }

    private val micCapture = MicCaptureManager()

    private val _state = MutableStateFlow(WakeState.IDLE)
    val state: StateFlow<WakeState> = _state.asStateFlow()

    private var listenJob: Job? = null

    /**
     * Start listening for the wake word.
     */
    fun startListening() {
        if (_state.value == WakeState.LISTENING) return
        if (!preferences.isEnabled) {
            Log.d(TAG, "Voice wake is disabled in preferences")
            return
        }

        val started = micCapture.startCapture()
        if (!started) {
            Log.e(TAG, "Failed to start mic capture")
            return
        }

        _state.value = WakeState.LISTENING
        Log.i(TAG, "Wake word listening started: '${preferences.wakePhrase}'")

        listenJob = scope.launch {
            micCapture.captureLoop { buffer, rms ->
                if (micCapture.isSpeechDetected(rms)) {
                    processAudioForWakeWord(buffer)
                }
            }
        }
    }

    /**
     * Stop listening for the wake word.
     */
    fun stopListening() {
        listenJob?.cancel()
        listenJob = null
        micCapture.stopCapture()
        _state.value = WakeState.IDLE
        Log.i(TAG, "Wake word listening stopped")
    }

    /**
     * Process an audio buffer for wake word detection.
     *
     * This is a simplified implementation. In production, this would
     * integrate with an on-device wake word engine (e.g., Porcupine, Snowboy).
     */
    private fun processAudioForWakeWord(buffer: ShortArray) {
        // Wake word engine integration point
        // For now, this is a placeholder that would be replaced with
        // actual on-device keyword spotting
    }

    /**
     * Trigger wake word detected flow.
     * Called when the wake word engine detects a match.
     */
    internal fun onWakeWordDetected() {
        if (_state.value != WakeState.LISTENING) return

        _state.value = WakeState.DETECTED
        Log.i(TAG, "Wake word detected!")

        if (preferences.hapticFeedback) {
            triggerHaptic()
        }

        onWakeDetected()

        scope.launch {
            delay(TalkDefaults.WAKE_COOLDOWN_MS)
            if (_state.value == WakeState.DETECTED || _state.value == WakeState.COOLDOWN) {
                _state.value = WakeState.COOLDOWN
                delay(TalkDefaults.WAKE_COOLDOWN_MS)
                if (_state.value == WakeState.COOLDOWN) {
                    _state.value = WakeState.LISTENING
                }
            }
        }
    }

    private fun triggerHaptic() {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            vibrator?.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (e: Exception) {
            Log.w(TAG, "Haptic feedback failed: ${e.message}")
        }
    }
}
