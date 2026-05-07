package ai.coreblow.app.voice

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted preferences for voice wake word configuration.
 * Uses EncryptedSharedPreferences (AES256-GCM) to protect
 * sensitive wake-word models and custom phrases.
 */
class VoiceWakePreferences(context: Context) {

    companion object {
        private const val TAG = "VoiceWakePrefs"
        private const val PREFS_NAME = "coreblow_voice_wake_prefs"

        // Keys
        private const val KEY_WAKE_ENABLED = "wake_enabled"
        private const val KEY_WAKE_PHRASE = "wake_phrase"
        private const val KEY_WAKE_SENSITIVITY = "wake_sensitivity"
        private const val KEY_WAKE_SOUND_ENABLED = "wake_sound_enabled"
        private const val KEY_WAKE_VIBRATE_ENABLED = "wake_vibrate_enabled"
        private const val KEY_WAKE_COOLDOWN_MS = "wake_cooldown_ms"
        private const val KEY_WAKE_AUTO_RECORD = "wake_auto_record"
        private const val KEY_WAKE_MODEL_PATH = "wake_model_path"
        private const val KEY_WAKE_CUSTOM_PHRASES = "wake_custom_phrases"
        private const val KEY_WAKE_HISTORY_ENABLED = "wake_history_enabled"
        private const val KEY_WAKE_MAX_HISTORY = "wake_max_history"
        private const val KEY_LAST_WAKE_TIMESTAMP = "last_wake_timestamp"
        private const val KEY_TOTAL_WAKE_COUNT = "total_wake_count"
        private const val KEY_VAD_ENABLED = "vad_enabled"
        private const val KEY_VAD_SENSITIVITY = "vad_sensitivity"
        private const val KEY_SILENCE_THRESHOLD = "silence_threshold"
        private const val KEY_TTS_VOICE = "tts_voice"
        private const val KEY_TTS_SPEED = "tts_speed"
        private const val KEY_TTS_PITCH = "tts_pitch"
        private const val KEY_TTS_AUTO_PLAY = "tts_auto_play"
        private const val KEY_RECORDING_MAX_SEC = "recording_max_sec"
        private const val KEY_LANGUAGE = "language"
    }

    private val prefs = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (e: Exception) {
        Log.e(TAG, "Failed to create encrypted prefs: ${e.message}")
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Wake word settings
    var isWakeEnabled: Boolean
        get() = prefs.getBoolean(KEY_WAKE_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_WAKE_ENABLED, value).apply()

    var wakePhrase: String
        get() = prefs.getString(KEY_WAKE_PHRASE, TalkDefaults.DEFAULT_WAKE_PHRASE) ?: TalkDefaults.DEFAULT_WAKE_PHRASE
        set(value) = prefs.edit().putString(KEY_WAKE_PHRASE, value.trim().lowercase().take(TalkDefaults.WAKE_MAX_PHRASE_LENGTH)).apply()

    var wakeSensitivity: Float
        get() = prefs.getFloat(KEY_WAKE_SENSITIVITY, TalkDefaults.WAKE_CONFIDENCE_THRESHOLD)
        set(value) = prefs.edit().putFloat(KEY_WAKE_SENSITIVITY, value.coerceIn(0.1f, 1.0f)).apply()

    var wakeSoundEnabled: Boolean
        get() = prefs.getBoolean(KEY_WAKE_SOUND_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_WAKE_SOUND_ENABLED, value).apply()

    var wakeVibrateEnabled: Boolean
        get() = prefs.getBoolean(KEY_WAKE_VIBRATE_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_WAKE_VIBRATE_ENABLED, value).apply()

    var wakeCooldownMs: Long
        get() = prefs.getLong(KEY_WAKE_COOLDOWN_MS, TalkDefaults.WAKE_COOLDOWN_MS)
        set(value) = prefs.edit().putLong(KEY_WAKE_COOLDOWN_MS, value.coerceIn(500, 10_000)).apply()

    var wakeAutoRecord: Boolean
        get() = prefs.getBoolean(KEY_WAKE_AUTO_RECORD, true)
        set(value) = prefs.edit().putBoolean(KEY_WAKE_AUTO_RECORD, value).apply()

    var wakeModelPath: String?
        get() = prefs.getString(KEY_WAKE_MODEL_PATH, null)
        set(value) = prefs.edit().putString(KEY_WAKE_MODEL_PATH, value).apply()

    // Custom phrases (pipe-separated)
    var customPhrases: List<String>
        get() = prefs.getString(KEY_WAKE_CUSTOM_PHRASES, "")?.split("|")?.filter { it.isNotBlank() } ?: emptyList()
        set(value) = prefs.edit().putString(KEY_WAKE_CUSTOM_PHRASES, value.joinToString("|")).apply()

    fun addCustomPhrase(phrase: String) {
        val current = customPhrases.toMutableList()
        if (phrase.trim() !in current) { current.add(phrase.trim()); customPhrases = current }
    }

    fun removeCustomPhrase(phrase: String) {
        customPhrases = customPhrases.filter { it != phrase.trim() }
    }

    // Wake history
    var wakeHistoryEnabled: Boolean
        get() = prefs.getBoolean(KEY_WAKE_HISTORY_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_WAKE_HISTORY_ENABLED, value).apply()

    var lastWakeTimestamp: Long
        get() = prefs.getLong(KEY_LAST_WAKE_TIMESTAMP, 0)
        set(value) = prefs.edit().putLong(KEY_LAST_WAKE_TIMESTAMP, value).apply()

    var totalWakeCount: Long
        get() = prefs.getLong(KEY_TOTAL_WAKE_COUNT, 0)
        set(value) = prefs.edit().putLong(KEY_TOTAL_WAKE_COUNT, value).apply()

    fun recordWakeEvent() {
        totalWakeCount++
        lastWakeTimestamp = System.currentTimeMillis()
    }

    // VAD settings
    var vadEnabled: Boolean
        get() = prefs.getBoolean(KEY_VAD_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_VAD_ENABLED, value).apply()

    var vadSensitivity: Float
        get() = prefs.getFloat(KEY_VAD_SENSITIVITY, 1.0f)
        set(value) = prefs.edit().putFloat(KEY_VAD_SENSITIVITY, value.coerceIn(0.1f, 2.0f)).apply()

    var silenceThreshold: Float
        get() = prefs.getFloat(KEY_SILENCE_THRESHOLD, TalkDefaults.SILENCE_THRESHOLD_RMS.toFloat())
        set(value) = prefs.edit().putFloat(KEY_SILENCE_THRESHOLD, value).apply()

    // TTS settings
    var ttsVoice: String
        get() = prefs.getString(KEY_TTS_VOICE, "alloy") ?: "alloy"
        set(value) = prefs.edit().putString(KEY_TTS_VOICE, value).apply()

    var ttsSpeed: Float
        get() = prefs.getFloat(KEY_TTS_SPEED, TalkDefaults.TTS_SPEECH_RATE)
        set(value) = prefs.edit().putFloat(KEY_TTS_SPEED, value.coerceIn(0.5f, 2.0f)).apply()

    var ttsPitch: Float
        get() = prefs.getFloat(KEY_TTS_PITCH, TalkDefaults.TTS_PITCH)
        set(value) = prefs.edit().putFloat(KEY_TTS_PITCH, value.coerceIn(0.5f, 2.0f)).apply()

    var ttsAutoPlay: Boolean
        get() = prefs.getBoolean(KEY_TTS_AUTO_PLAY, true)
        set(value) = prefs.edit().putBoolean(KEY_TTS_AUTO_PLAY, value).apply()

    // Recording settings
    var maxRecordingSec: Int
        get() = prefs.getInt(KEY_RECORDING_MAX_SEC, TalkDefaults.MAX_RECORDING_DURATION_SEC)
        set(value) = prefs.edit().putInt(KEY_RECORDING_MAX_SEC, value.coerceIn(5, 300)).apply()

    var language: String
        get() = prefs.getString(KEY_LANGUAGE, "auto") ?: "auto"
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    /**
     * Reset all voice preferences to defaults.
     */
    fun resetToDefaults() {
        prefs.edit().clear().apply()
        Log.i(TAG, "Voice preferences reset to defaults")
    }

    /**
     * Export all settings as a map.
     */
    fun exportSettings(): Map<String, Any> = mapOf(
        "wakeEnabled" to isWakeEnabled,
        "wakePhrase" to wakePhrase,
        "wakeSensitivity" to wakeSensitivity,
        "vadEnabled" to vadEnabled,
        "vadSensitivity" to vadSensitivity,
        "ttsVoice" to ttsVoice,
        "ttsSpeed" to ttsSpeed,
        "ttsAutoPlay" to ttsAutoPlay,
        "maxRecordingSec" to maxRecordingSec,
        "language" to language,
        "totalWakeCount" to totalWakeCount,
    )
}
