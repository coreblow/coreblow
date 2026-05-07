package ai.coreblow.app.voice

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Wake word detection state.
 */
enum class WakeState {
    IDLE,
    LISTENING,
    DETECTED,
    ERROR,
}

/**
 * Manages wake word detection using energy-based voice activity detection
 * with a two-stage approach: sustained energy threshold followed by
 * cadence pattern matching for a "hey coreblow" style trigger.
 *
 * Also supports keyword extraction from post-wake speech via
 * VoiceWakeCommandExtractor.
 */
class VoiceWakeManager(
    private val appContext: Context,
    private val scope: CoroutineScope,
    private val prefs: VoiceWakePreferences,
    private val onWakeDetected: () -> Unit,
) {
    companion object {
        private const val TAG = "VoiceWakeManager"
        private const val SAMPLE_RATE = 16000
        private const val ENERGY_WINDOW_SIZE = 10
        private const val MIN_WAKE_FRAMES = 3
        private const val MAX_WAKE_FRAMES = 15
        private const val POST_WAKE_SILENCE_MS = 500L
        private const val COOLDOWN_AFTER_WAKE_MS = 3000L
    }

    private val _state = MutableStateFlow(WakeState.IDLE)
    val state: StateFlow<WakeState> = _state.asStateFlow()

    private val _wakeConfidence = MutableStateFlow(0f)
    val wakeConfidence: StateFlow<Float> = _wakeConfidence.asStateFlow()

    private val _isEnabled = MutableStateFlow(false)
    val isEnabled: StateFlow<Boolean> = _isEnabled.asStateFlow()

    private var listenJob: Job? = null
    private var audioRecord: AudioRecord? = null
    private val energyHistory = ArrayDeque<Double>(ENERGY_WINDOW_SIZE)
    private var lastWakeTimeMs = 0L
    private var consecutiveVoiceFrames = 0
    private var sensitivity: Float = 1.0f

    init {
        sensitivity = prefs.getSensitivity()
    }

    // MARK: - Public API

    fun startListening() {
        if (_state.value == WakeState.LISTENING) return
        sensitivity = prefs.getSensitivity()

        _state.value = WakeState.LISTENING
        _isEnabled.value = true
        consecutiveVoiceFrames = 0
        energyHistory.clear()

        listenJob?.cancel()
        listenJob = scope.launch(Dispatchers.IO) {
            startAudioCapture()
        }
    }

    fun stopListening() {
        listenJob?.cancel()
        listenJob = null
        stopAudioCapture()
        _state.value = WakeState.IDLE
        _isEnabled.value = false
        _wakeConfidence.value = 0f
        consecutiveVoiceFrames = 0
    }

    fun setSensitivity(value: Float) {
        sensitivity = value.coerceIn(0.1f, 3.0f)
        prefs.setSensitivity(sensitivity)
    }

    // MARK: - Audio Capture

    @android.annotation.SuppressLint("MissingPermission")
    private suspend fun startAudioCapture() {
        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        ).coerceAtLeast(4096)

        try {
            val record = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize")
                record.release()
                _state.value = WakeState.ERROR
                return
            }

            audioRecord = record
            record.startRecording()
            Log.i(TAG, "Wake detection started (sensitivity=$sensitivity)")

            val buffer = ShortArray(bufferSize / 2)
            var scope = this.scope

            while (scope.isActive && _state.value == WakeState.LISTENING) {
                val read = record.read(buffer, 0, buffer.size)
                if (read <= 0) continue

                val samples = buffer.copyOf(read)
                processFrame(samples)
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Mic permission denied for wake: ${e.message}")
            _state.value = WakeState.ERROR
        } catch (e: Exception) {
            Log.e(TAG, "Wake capture error: ${e.message}")
            _state.value = WakeState.ERROR
        } finally {
            stopAudioCapture()
        }
    }

    private fun stopAudioCapture() {
        audioRecord?.let { record ->
            try {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) record.stop()
                record.release()
            } catch (_: Throwable) {}
        }
        audioRecord = null
    }

    // MARK: - Detection Logic

    private fun processFrame(samples: ShortArray) {
        val energy = calculateRmsEnergy(samples)
        updateEnergyHistory(energy)

        val threshold = calculateAdaptiveThreshold()
        val isVoice = energy > threshold

        if (isVoice) {
            consecutiveVoiceFrames++
            val confidence = (consecutiveVoiceFrames.toFloat() / MAX_WAKE_FRAMES).coerceIn(0f, 1f)
            _wakeConfidence.value = confidence

            if (consecutiveVoiceFrames >= MIN_WAKE_FRAMES) {
                // Check cadence pattern (rising-falling energy pattern)
                if (matchesCadencePattern() && !isInCooldown()) {
                    onWakeWordDetected()
                }
            }
        } else {
            if (consecutiveVoiceFrames > 0) {
                consecutiveVoiceFrames = (consecutiveVoiceFrames - 1).coerceAtLeast(0)
            }
            _wakeConfidence.value = (consecutiveVoiceFrames.toFloat() / MAX_WAKE_FRAMES).coerceIn(0f, 1f)
        }
    }

    private fun calculateRmsEnergy(samples: ShortArray): Double {
        if (samples.isEmpty()) return 0.0
        var sum = 0.0
        for (s in samples) sum += s.toDouble() * s.toDouble()
        return sqrt(sum / samples.size)
    }

    private fun updateEnergyHistory(energy: Double) {
        if (energyHistory.size >= ENERGY_WINDOW_SIZE) energyHistory.removeFirst()
        energyHistory.addLast(energy)
    }

    private fun calculateAdaptiveThreshold(): Double {
        if (energyHistory.isEmpty()) return TalkDefaults.SILENCE_THRESHOLD_RMS / sensitivity

        // Use running average + stddev for adaptive threshold
        val mean = energyHistory.average()
        val variance = energyHistory.map { (it - mean) * (it - mean) }.average()
        val stddev = sqrt(variance)

        // Threshold = mean + 1.5 * stddev, scaled by sensitivity
        return (mean + 1.5 * stddev) / sensitivity
    }

    private fun matchesCadencePattern(): Boolean {
        if (energyHistory.size < 4) return false

        // Look for rising-then-sustained pattern (typical of "hey X" phrases)
        val recent = energyHistory.toList().takeLast(6)
        if (recent.size < 4) return false

        val firstHalf = recent.take(recent.size / 2).average()
        val secondHalf = recent.drop(recent.size / 2).average()

        // The second half should be at least 60% of the first (sustained speech)
        return secondHalf > firstHalf * 0.6
    }

    private fun isInCooldown(): Boolean {
        return System.currentTimeMillis() - lastWakeTimeMs < COOLDOWN_AFTER_WAKE_MS
    }

    private fun onWakeWordDetected() {
        lastWakeTimeMs = System.currentTimeMillis()
        _state.value = WakeState.DETECTED
        _wakeConfidence.value = 1.0f
        consecutiveVoiceFrames = 0
        Log.i(TAG, "Wake word detected!")

        onWakeDetected()

        // Resume listening after cooldown
        scope.launch {
            kotlinx.coroutines.delay(COOLDOWN_AFTER_WAKE_MS)
            if (_isEnabled.value) {
                _state.value = WakeState.LISTENING
                consecutiveVoiceFrames = 0
                _wakeConfidence.value = 0f
            }
        }
    }
}
