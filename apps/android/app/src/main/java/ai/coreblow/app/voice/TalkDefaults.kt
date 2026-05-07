package ai.coreblow.app.voice

/**
 * Default constants for talk mode / voice pipeline.
 */
object TalkDefaults {
    /** RMS threshold below which audio is considered silence. */
    const val SILENCE_THRESHOLD_RMS = 350.0

    /** Consecutive silence frames before auto-stopping capture. */
    const val SILENCE_FRAMES_TO_STOP = 25

    /** Minimum voice frames before a capture is considered valid speech. */
    const val MIN_VOICE_FRAMES = 5

    /** Cooldown between voice captures in milliseconds. */
    const val CAPTURE_COOLDOWN_MS = 2000L

    /** Max recording duration before auto-stop (seconds). */
    const val MAX_RECORDING_DURATION_SEC = 60

    /** TTS chunk max length for splitting long responses. */
    const val TTS_CHUNK_MAX_LENGTH = 500

    /** Audio sample rate for capture. */
    const val SAMPLE_RATE = 16000

    /** Audio buffer size multiplier. */
    const val BUFFER_SIZE_MULTIPLIER = 2

    /** Input level smoothing factor (0–1, higher = more responsive). */
    const val INPUT_LEVEL_SMOOTHING = 0.3f

    /** Max input level RMS for normalization. */
    const val INPUT_LEVEL_MAX_RMS = 8000.0f

    /** Wake word cooldown after detection. */
    const val WAKE_COOLDOWN_MS = 3000L

    /** TTS playback speed. */
    const val TTS_SPEECH_RATE = 1.0f

    /** TTS pitch. */
    const val TTS_PITCH = 1.0f

    /** Max TTS queue size. */
    const val TTS_MAX_QUEUE_SIZE = 10

    /** Gateway audio upload timeout. */
    const val AUDIO_UPLOAD_TIMEOUT_MS = 30_000L
}

/**
 * Gateway configuration for talk mode sessions.
 */
data class TalkModeGatewayConfig(
    val enableStreaming: Boolean = true,
    val audioFormat: String = "pcm16",
    val sampleRate: Int = TalkDefaults.SAMPLE_RATE,
    val language: String = "auto",
    val model: String? = null,
    val systemPrompt: String? = null,
    val maxResponseTokens: Int? = null,
    val enableTts: Boolean = true,
    val ttsVoice: String? = null,
    val ttsSpeed: Float = TalkDefaults.TTS_SPEECH_RATE,
    val vadSensitivity: Float = 1.0f,
    val silenceThreshold: Double = TalkDefaults.SILENCE_THRESHOLD_RMS,
    val silenceFramesToStop: Int = TalkDefaults.SILENCE_FRAMES_TO_STOP,
)
