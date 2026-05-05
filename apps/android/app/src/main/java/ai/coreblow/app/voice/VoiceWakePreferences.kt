package ai.coreblow.app.voice

import android.content.Context
import android.content.SharedPreferences

/**
 * User preferences for the voice wake system.
 *
 * Stores wake phrase, enabled state, and sensitivity settings
 * in SharedPreferences.
 */
class VoiceWakePreferences(context: Context) {

    companion object {
        private const val PREFS_NAME = "coreblow_voice_wake"
        private const val KEY_ENABLED = "enabled"
        private const val KEY_WAKE_PHRASE = "wake_phrase"
        private const val KEY_SENSITIVITY = "sensitivity"
        private const val KEY_HAPTIC_FEEDBACK = "haptic_feedback"
        private const val KEY_SOUND_FEEDBACK = "sound_feedback"
        private const val KEY_CONTINUOUS_LISTENING = "continuous_listening"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** Whether wake word detection is enabled. */
    var isEnabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    /** The wake phrase to listen for. */
    var wakePhrase: String
        get() = prefs.getString(KEY_WAKE_PHRASE, TalkDefaults.DEFAULT_WAKE_PHRASE)
            ?: TalkDefaults.DEFAULT_WAKE_PHRASE
        set(value) = prefs.edit().putString(KEY_WAKE_PHRASE, value.lowercase().trim()).apply()

    /** Detection sensitivity (0.0 = least sensitive, 1.0 = most sensitive). */
    var sensitivity: Float
        get() = prefs.getFloat(KEY_SENSITIVITY, TalkDefaults.MIN_WAKE_CONFIDENCE)
        set(value) = prefs.edit().putFloat(KEY_SENSITIVITY, value.coerceIn(0.1f, 1.0f)).apply()

    /** Whether to provide haptic feedback on wake word detection. */
    var hapticFeedback: Boolean
        get() = prefs.getBoolean(KEY_HAPTIC_FEEDBACK, true)
        set(value) = prefs.edit().putBoolean(KEY_HAPTIC_FEEDBACK, value).apply()

    /** Whether to play a sound on wake word detection. */
    var soundFeedback: Boolean
        get() = prefs.getBoolean(KEY_SOUND_FEEDBACK, true)
        set(value) = prefs.edit().putBoolean(KEY_SOUND_FEEDBACK, value).apply()

    /** Whether to keep listening after processing a command. */
    var continuousListening: Boolean
        get() = prefs.getBoolean(KEY_CONTINUOUS_LISTENING, false)
        set(value) = prefs.edit().putBoolean(KEY_CONTINUOUS_LISTENING, value).apply()
}
