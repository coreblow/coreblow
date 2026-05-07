package ai.coreblow.app.voice

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Full-featured microphone capture manager for voice wake and talk mode.
 * Provides PCM audio buffers, VAD, input level metering, gateway event
 * routing, transcript handling, and cooldown management.
 */
class MicCaptureManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val sendToGateway: suspend (message: String, onRunIdKnown: (String) -> Unit) -> String,
    private val speakAssistantReply: (String) -> Unit,
) {
    companion object {
        private const val TAG = "MicCaptureManager"
        private const val COOLDOWN_MS = 1500L
        private const val INPUT_LEVEL_DECAY = 0.92f
        private const val INPUT_LEVEL_ATTACK = 0.35f
        private const val MAX_RECORDING_MS = 60_000L
        private const val SILENCE_END_MS = 2000L
    }

    private var audioRecord: AudioRecord? = null
    private val bufferSize: Int by lazy {
        val minSize = AudioRecord.getMinBufferSize(
            TalkDefaults.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        maxOf(minSize, TalkDefaults.MIN_BUFFER_SIZE)
    }

    // MARK: - State Flows

    private val _statusText = MutableStateFlow("Idle")
    val statusText: StateFlow<String> = _statusText.asStateFlow()

    private val _liveTranscript = MutableStateFlow<String?>(null)
    val liveTranscript: StateFlow<String?> = _liveTranscript.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _micEnabled = MutableStateFlow(false)
    val micEnabled: StateFlow<Boolean> = _micEnabled.asStateFlow()

    private val _micCooldown = MutableStateFlow(false)
    val micCooldown: StateFlow<Boolean> = _micCooldown.asStateFlow()

    private val _inputLevel = MutableStateFlow(0f)
    val inputLevel: StateFlow<Float> = _inputLevel.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private var captureJob: Job? = null
    private var cooldownJob: Job? = null
    private var currentRunId: String? = null
    private var smoothedLevel: Float = 0f
    private var gatewayConnected = false

    val isRecording: Boolean
        get() = audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING

    // MARK: - Public API

    fun setMicEnabled(enabled: Boolean) {
        _micEnabled.value = enabled
        if (enabled) {
            _statusText.value = "Ready"
        } else {
            stopCapture()
            _statusText.value = "Mic off"
            _isListening.value = false
            _inputLevel.value = 0f
            _liveTranscript.value = null
        }
    }

    fun onGatewayConnectionChanged(connected: Boolean) {
        gatewayConnected = connected
        if (!connected) {
            _statusText.value = "Disconnected"
            stopCapture()
        } else {
            _statusText.value = if (_micEnabled.value) "Ready" else "Mic off"
        }
    }

    // MARK: - Capture

    @SuppressLint("MissingPermission")
    fun startCapture(): Boolean {
        if (isRecording) return true
        if (!_micEnabled.value) return false

        return try {
            val record = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                TalkDefaults.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize")
                record.release()
                _statusText.value = "Mic init failed"
                return false
            }

            record.startRecording()
            audioRecord = record
            _isListening.value = true
            _statusText.value = "Listening…"
            Log.i(TAG, "Mic capture started (buffer=$bufferSize)")

            startCaptureLoop()
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Mic permission denied: ${e.message}")
            _statusText.value = "Permission denied"
            false
        } catch (e: Exception) {
            Log.e(TAG, "Mic capture error: ${e.message}")
            _statusText.value = "Error: ${e.message}"
            false
        }
    }

    fun stopCapture() {
        captureJob?.cancel()
        captureJob = null
        audioRecord?.let { record ->
            try {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) record.stop()
                record.release()
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping capture: ${e.message}")
            }
        }
        audioRecord = null
        _isListening.value = false
        _inputLevel.value = 0f
        smoothedLevel = 0f
        Log.i(TAG, "Mic capture stopped")
    }

    private fun startCaptureLoop() {
        captureJob?.cancel()
        captureJob = scope.launch(Dispatchers.IO) {
            val audioChunks = mutableListOf<ShortArray>()
            var silenceStart = 0L
            val startTime = System.currentTimeMillis()
            var hasSpeech = false

            while (isActive && isRecording) {
                val buffer = readBuffer() ?: break
                val rms = calculateRms(buffer)

                // Update input level meter
                updateInputLevel(rms)

                val elapsed = System.currentTimeMillis() - startTime
                if (elapsed > MAX_RECORDING_MS) {
                    if (audioChunks.isNotEmpty()) finishCapture(audioChunks)
                    break
                }

                audioChunks.add(buffer)

                if (isSpeechDetected(rms)) {
                    hasSpeech = true
                    silenceStart = 0L
                } else {
                    if (hasSpeech && silenceStart == 0L) {
                        silenceStart = System.currentTimeMillis()
                    } else if (hasSpeech && silenceStart > 0 && System.currentTimeMillis() - silenceStart > SILENCE_END_MS) {
                        finishCapture(audioChunks)
                        break
                    }
                }
            }
        }
    }

    private suspend fun finishCapture(chunks: List<ShortArray>) {
        stopCapture()
        if (chunks.isEmpty()) {
            _statusText.value = "No speech detected"
            startCooldown()
            return
        }

        _statusText.value = "Processing…"
        _isSending.value = true

        val totalSamples = chunks.sumOf { it.size }
        val durationMs = (totalSamples.toLong() * 1000) / TalkDefaults.SAMPLE_RATE
        Log.i(TAG, "Captured ${chunks.size} chunks, ~${durationMs}ms")

        // Encode and send to gateway
        val message = "[voice:${durationMs}ms:${chunks.size}chunks]"
        try {
            val runId = sendToGateway(message) { id -> currentRunId = id }
            currentRunId = runId
            _statusText.value = "Sent"
        } catch (e: Throwable) {
            Log.e(TAG, "Send failed: ${e.message}")
            _statusText.value = "Send failed"
        } finally {
            _isSending.value = false
            startCooldown()
        }
    }

    // MARK: - Gateway Events

    fun handleGatewayEvent(event: String, payloadJson: String?) {
        when (event) {
            "chat" -> handleChatResponse(payloadJson)
            "voice.transcript" -> handleTranscript(payloadJson)
            "voice.cancel" -> handleCancel()
        }
    }

    private fun handleChatResponse(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        try {
            val json = Json { ignoreUnknownKeys = true }
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val runId = (root["runId"] as? JsonPrimitive)?.content
            if (runId != null && runId == currentRunId) {
                val state = (root["state"] as? JsonPrimitive)?.content
                when (state) {
                    "delta" -> {
                        val text = extractDeltaText(root)
                        if (!text.isNullOrBlank()) _liveTranscript.value = text
                    }
                    "final" -> {
                        currentRunId = null
                        _liveTranscript.value = null
                        _statusText.value = if (_micEnabled.value) "Ready" else "Idle"
                    }
                    "error" -> {
                        currentRunId = null
                        _statusText.value = "Error"
                        _liveTranscript.value = null
                    }
                }
            }
        } catch (_: Throwable) {}
    }

    private fun extractDeltaText(root: JsonObject): String? {
        val message = root["message"] as? JsonObject ?: return null
        val content = message["content"] as? kotlinx.serialization.json.JsonArray ?: return null
        for (item in content) {
            val obj = item as? JsonObject ?: continue
            if ((obj["type"] as? JsonPrimitive)?.content == "text") {
                return (obj["text"] as? JsonPrimitive)?.content
            }
        }
        return null
    }

    private fun handleTranscript(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        try {
            val json = Json { ignoreUnknownKeys = true }
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val transcript = (root["text"] as? JsonPrimitive)?.content?.trim()
            val isFinal = (root["isFinal"] as? JsonPrimitive)?.content?.toBoolean() ?: false
            if (!transcript.isNullOrEmpty()) {
                _liveTranscript.value = transcript
                if (isFinal) {
                    scope.launch { delay(2000); if (_liveTranscript.value == transcript) _liveTranscript.value = null }
                }
            }
        } catch (_: Throwable) {}
    }

    private fun handleCancel() {
        currentRunId = null
        _isSending.value = false
        _liveTranscript.value = null
        _statusText.value = if (_micEnabled.value) "Ready" else "Idle"
    }

    // MARK: - Audio Helpers

    fun readBuffer(): ShortArray? {
        val record = audioRecord ?: return null
        val buffer = ShortArray(bufferSize / 2)
        val read = record.read(buffer, 0, buffer.size)
        return if (read > 0) buffer.copyOf(read) else null
    }

    fun calculateRms(buffer: ShortArray): Double {
        if (buffer.isEmpty()) return 0.0
        var sum = 0.0
        for (sample in buffer) sum += sample.toDouble() * sample.toDouble()
        return sqrt(sum / buffer.size)
    }

    fun isSpeechDetected(rms: Double): Boolean = rms > TalkDefaults.SILENCE_THRESHOLD_RMS

    private fun updateInputLevel(rms: Double) {
        val normalized = (rms / 8000.0).toFloat().coerceIn(0f, 1f)
        smoothedLevel = if (normalized > smoothedLevel) {
            smoothedLevel + (normalized - smoothedLevel) * INPUT_LEVEL_ATTACK
        } else {
            smoothedLevel * INPUT_LEVEL_DECAY
        }
        _inputLevel.value = smoothedLevel
    }

    // MARK: - Cooldown

    private fun startCooldown() {
        cooldownJob?.cancel()
        _micCooldown.value = true
        cooldownJob = scope.launch {
            delay(COOLDOWN_MS)
            _micCooldown.value = false
            if (_micEnabled.value && gatewayConnected) {
                _statusText.value = "Ready"
            }
        }
    }
}
