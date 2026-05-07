package ai.coreblow.app.voice

import android.media.AudioFormat

/**
 * Default configuration constants for Talk Mode (voice interaction).
 * Centralizes all audio, recording, TTS, and gateway parameters
 * to prevent magic-number fragmentation across the voice subsystem.
 */
object TalkDefaults {

    // ── Audio Recording ──────────────────────────────────────

    /** Sample rate for voice capture (Hz). */
    const val SAMPLE_RATE = 16_000

    /** Audio encoding format. */
    const val AUDIO_ENCODING = AudioFormat.ENCODING_PCM_16BIT

    /** Audio channel configuration. */
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO

    /** Audio source for recording. */
    const val AUDIO_SOURCE = android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION

    /** Maximum recording duration in seconds. */
    const val MAX_RECORDING_DURATION_SEC = 60

    /** Minimum recording duration for valid input (ms). */
    const val MIN_RECORDING_DURATION_MS = 500L

    /** Audio buffer size multiplier for smoother capture. */
    const val BUFFER_SIZE_MULTIPLIER = 2

    // ── Voice Activity Detection (VAD) ──────────────────────

    /** RMS silence threshold — below this is considered silence. */
    const val SILENCE_THRESHOLD_RMS = 350.0

    /** Duration of silence before auto-stop (ms). */
    const val SILENCE_DURATION_MS = 2000L

    /** Minimum voice duration to consider a valid utterance (ms). */
    const val MIN_VOICE_DURATION_MS = 300L

    /** VAD look-ahead buffer size in frames. */
    const val VAD_BUFFER_FRAMES = 10

    /** VAD energy smoothing factor (0-1, higher = more smoothing). */
    const val VAD_SMOOTHING_FACTOR = 0.3f

    // ── Text-to-Speech ──────────────────────────────────────

    /** Default TTS speech rate (1.0 = normal). */
    const val TTS_SPEECH_RATE = 1.0f

    /** Default TTS pitch (1.0 = normal). */
    const val TTS_PITCH = 1.0f

    /** Maximum TTS text length per utterance. */
    const val TTS_MAX_TEXT_LENGTH = 4096

    /** TTS queue max depth. */
    const val TTS_MAX_QUEUE_SIZE = 10

    /** Delay between TTS chunks (ms). */
    const val TTS_CHUNK_DELAY_MS = 100L

    // ── Wake Word ───────────────────────────────────────────

    /** Default wake phrase. */
    const val DEFAULT_WAKE_PHRASE = "hey coreblow"

    /** Wake word detection confidence threshold (0-1). */
    const val WAKE_CONFIDENCE_THRESHOLD = 0.7f

    /** Cooldown after wake detection before listening again (ms). */
    const val WAKE_COOLDOWN_MS = 3000L

    /** Maximum wake word length in characters. */
    const val WAKE_MAX_PHRASE_LENGTH = 50

    // ── Gateway Communication ───────────────────────────────

    /** WebSocket audio chunk size for streaming (bytes). */
    const val WS_AUDIO_CHUNK_SIZE = 4096

    /** Maximum audio payload size for gateway (bytes). */
    const val MAX_AUDIO_PAYLOAD_BYTES = 10 * 1024 * 1024 // 10MB

    /** Audio format for gateway transmission. */
    const val GATEWAY_AUDIO_FORMAT = "pcm_s16le"

    /** Gateway audio streaming protocol. */
    const val GATEWAY_STREAM_PROTOCOL = "websocket"

    /** Timeout for gateway voice request (ms). */
    const val GATEWAY_VOICE_TIMEOUT_MS = 30_000L

    /** Retry delay for voice gateway reconnection (ms). */
    const val GATEWAY_VOICE_RETRY_MS = 2_000L

    // ── UI ──────────────────────────────────────────────────

    /** Audio level update interval (ms). */
    const val AUDIO_LEVEL_UPDATE_MS = 50L

    /** Audio level visualization smoothing. */
    const val AUDIO_LEVEL_SMOOTHING = 0.4f

    /** Number of waveform bars in the visualizer. */
    const val WAVEFORM_BAR_COUNT = 32

    /** Pulse animation duration (ms). */
    const val PULSE_DURATION_MS = 1000L

    /** Recording indicator blink interval (ms). */
    const val RECORDING_BLINK_MS = 800L
}

/**
 * Talk mode gateway configuration — connection parameters
 * for real-time voice streaming to the gateway.
 */
data class TalkModeGatewayConfig(
    val host: String,
    val port: Int = 18789,
    val useTls: Boolean = false,
    val streamingEnabled: Boolean = true,
    val sttModel: String = "whisper-1",
    val ttsModel: String = "tts-1",
    val ttsVoice: String = "alloy",
    val language: String = "auto",
    val vadEnabled: Boolean = true,
    val vadSensitivity: Float = 1.0f,
    val silenceThreshold: Double = TalkDefaults.SILENCE_THRESHOLD_RMS,
    val maxRecordingSec: Int = TalkDefaults.MAX_RECORDING_DURATION_SEC,
    val autoPlay: Boolean = true,
    val enableWakeWord: Boolean = false,
    val wakePhrase: String = TalkDefaults.DEFAULT_WAKE_PHRASE,
) {
    val wsUrl: String get() {
        val scheme = if (useTls) "wss" else "ws"
        return "$scheme://$host:$port/voice"
    }

    val isValid: Boolean get() = host.isNotBlank() && port in 1..65535

    fun withLanguage(lang: String) = copy(language = lang)
    fun withVoice(voice: String) = copy(ttsVoice = voice)
    fun withVad(enabled: Boolean, sensitivity: Float = vadSensitivity) = copy(vadEnabled = enabled, vadSensitivity = sensitivity)
}
