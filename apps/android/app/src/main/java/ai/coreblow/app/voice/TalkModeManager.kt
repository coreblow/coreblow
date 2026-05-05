package ai.coreblow.app.voice

import android.content.Context
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Talk mode lifecycle state.
 */
enum class TalkModeState {
    INACTIVE,
    RECORDING,
    PROCESSING,
    SPEAKING,
    ERROR,
}

/**
 * Manages the full talk mode lifecycle:
 * wake detection → speech capture → gateway processing → TTS response.
 *
 * Coordinates between [VoiceWakeManager], [MicCaptureManager],
 * and the gateway session for end-to-end voice interaction.
 */
class TalkModeManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val onTranscript: (String) -> Unit,
) {
    companion object {
        private const val TAG = "TalkModeManager"
    }

    private val _state = MutableStateFlow(TalkModeState.INACTIVE)
    val state: StateFlow<TalkModeState> = _state.asStateFlow()

    private val micCapture = MicCaptureManager()
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recordingJob: Job? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    /**
     * Initialize TTS engine.
     */
    fun initialize() {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.getDefault()
                Log.i(TAG, "TTS initialized")
            } else {
                Log.e(TAG, "TTS initialization failed")
            }
        }
    }

    /**
     * Start recording user speech for processing.
     */
    fun startRecording() {
        if (_state.value == TalkModeState.RECORDING) return

        requestAudioFocus()

        val started = micCapture.startCapture()
        if (!started) {
            _state.value = TalkModeState.ERROR
            return
        }

        _state.value = TalkModeState.RECORDING
        Log.i(TAG, "Talk mode: recording started")

        val audioChunks = mutableListOf<ShortArray>()
        var silenceStart = 0L

        recordingJob = scope.launch {
            val startTime = System.currentTimeMillis()

            micCapture.captureLoop { buffer, rms ->
                val elapsed = System.currentTimeMillis() - startTime

                if (elapsed > TalkDefaults.MAX_RECORDING_DURATION_MS) {
                    finishRecording(audioChunks)
                    return@captureLoop
                }

                audioChunks.add(buffer)

                if (micCapture.isSpeechDetected(rms)) {
                    silenceStart = 0L
                } else {
                    if (silenceStart == 0L) {
                        silenceStart = System.currentTimeMillis()
                    } else if (System.currentTimeMillis() - silenceStart > TalkDefaults.SILENCE_TIMEOUT_MS) {
                        if (audioChunks.size > 3) {
                            finishRecording(audioChunks)
                        }
                    }
                }
            }
        }
    }

    /**
     * Stop recording and cancel processing.
     */
    fun stopRecording() {
        recordingJob?.cancel()
        recordingJob = null
        micCapture.stopCapture()
        abandonAudioFocus()

        if (_state.value == TalkModeState.RECORDING) {
            _state.value = TalkModeState.INACTIVE
        }
    }

    /**
     * Speak text aloud via TTS.
     */
    fun speak(text: String) {
        if (!ttsReady || text.isBlank()) return

        _state.value = TalkModeState.SPEAKING
        Log.i(TAG, "Speaking: ${text.take(50)}...")

        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "coreblow-tts")

        scope.launch {
            while (tts?.isSpeaking == true) {
                delay(100)
            }
            _state.value = TalkModeState.INACTIVE
        }
    }

    /**
     * Handle a directive from the gateway.
     */
    fun handleDirective(directive: TalkDirective) {
        when (directive) {
            is TalkDirective.Speak -> speak(directive.text)
            is TalkDirective.StopListening -> stopRecording()
            is TalkDirective.Navigate -> Log.i(TAG, "Navigate: ${directive.target}")
            is TalkDirective.Execute -> Log.i(TAG, "Execute: ${directive.command}")
            is TalkDirective.PlayAudio -> Log.i(TAG, "Play audio: ${directive.url}")
            is TalkDirective.Unknown -> Log.w(TAG, "Unknown directive: ${directive.type}")
        }
    }

    /**
     * Release all resources.
     */
    fun release() {
        stopRecording()
        tts?.shutdown()
        tts = null
        ttsReady = false
    }

    private fun finishRecording(chunks: List<ShortArray>) {
        micCapture.stopCapture()
        _state.value = TalkModeState.PROCESSING
        Log.i(TAG, "Recording finished: ${chunks.size} chunks")

        // In production, audio chunks would be sent to the gateway
        // for speech-to-text processing. For now, notify the listener.
        onTranscript("[audio captured: ${chunks.size} chunks]")
        _state.value = TalkModeState.INACTIVE
    }

    private fun requestAudioFocus() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setOnAudioFocusChangeListener { }
            .build()
        audioManager.requestAudioFocus(request)
        audioFocusRequest = request
    }

    private fun abandonAudioFocus() {
        audioFocusRequest?.let { request ->
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.abandonAudioFocusRequest(request)
        }
        audioFocusRequest = null
    }
}
