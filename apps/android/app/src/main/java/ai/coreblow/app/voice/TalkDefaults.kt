package ai.coreblow.app.voice

/**
 * Default configuration values for the talk mode system.
 */
object TalkDefaults {

    /** Minimum audio buffer size in bytes for mic capture. */
    const val MIN_BUFFER_SIZE = 4096

    /** Sample rate for audio capture in Hz. */
    const val SAMPLE_RATE = 16_000

    /** Audio encoding format. */
    const val ENCODING_PCM_16BIT = 2

    /** Channel configuration for mono input. */
    const val CHANNEL_MONO = 16

    /** Maximum recording duration in milliseconds. */
    const val MAX_RECORDING_DURATION_MS = 30_000L

    /** Silence threshold for VAD (voice activity detection). */
    const val SILENCE_THRESHOLD_RMS = 500.0

    /** Duration of silence before ending capture (ms). */
    const val SILENCE_TIMEOUT_MS = 1_500L

    /** Default wake phrase. */
    const val DEFAULT_WAKE_PHRASE = "hey coreblow"

    /** Minimum confidence score for wake word detection (0.0 - 1.0). */
    const val MIN_WAKE_CONFIDENCE = 0.7f

    /** Cooldown period after wake word detection (ms). */
    const val WAKE_COOLDOWN_MS = 3_000L

    /** Talk mode auto-timeout if no speech detected (ms). */
    const val TALK_MODE_TIMEOUT_MS = 10_000L

    /** Audio focus request duration hint (ms). */
    const val AUDIO_FOCUS_DURATION_MS = 5_000
}
