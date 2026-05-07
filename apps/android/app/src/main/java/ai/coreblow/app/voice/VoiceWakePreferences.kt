package ai.coreblow.app.voice

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted preferences for voice wake word settings.
 */
class VoiceWakePreferences(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "coreblow_voice_wake",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Throwable) {
        context.getSharedPreferences("coreblow_voice_wake_fallback", Context.MODE_PRIVATE)
    }

    fun isWakeEnabled(): Boolean = prefs.getBoolean(KEY_WAKE_ENABLED, false)
    fun setWakeEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_WAKE_ENABLED, enabled).apply()

    fun getSensitivity(): Float = prefs.getFloat(KEY_SENSITIVITY, 1.0f)
    fun setSensitivity(value: Float) = prefs.edit().putFloat(KEY_SENSITIVITY, value.coerceIn(0.1f, 3.0f)).apply()

    fun getWakePhrase(): String = prefs.getString(KEY_WAKE_PHRASE, "hey coreblow") ?: "hey coreblow"
    fun setWakePhrase(phrase: String) = prefs.edit().putString(KEY_WAKE_PHRASE, phrase.trim().lowercase()).apply()

    fun isAutoListenAfterWake(): Boolean = prefs.getBoolean(KEY_AUTO_LISTEN, true)
    fun setAutoListenAfterWake(enabled: Boolean) = prefs.edit().putBoolean(KEY_AUTO_LISTEN, enabled).apply()

    fun getWakeSound(): String = prefs.getString(KEY_WAKE_SOUND, "chime") ?: "chime"
    fun setWakeSound(sound: String) = prefs.edit().putString(KEY_WAKE_SOUND, sound).apply()

    fun isContinuousListening(): Boolean = prefs.getBoolean(KEY_CONTINUOUS, false)
    fun setContinuousListening(enabled: Boolean) = prefs.edit().putBoolean(KEY_CONTINUOUS, enabled).apply()

    fun getDetectionCount(): Int = prefs.getInt(KEY_DETECTION_COUNT, 0)
    fun incrementDetectionCount() = prefs.edit().putInt(KEY_DETECTION_COUNT, getDetectionCount() + 1).apply()

    fun getLastDetectionMs(): Long = prefs.getLong(KEY_LAST_DETECTION, 0)
    fun setLastDetectionMs(ms: Long) = prefs.edit().putLong(KEY_LAST_DETECTION, ms).apply()

    companion object {
        private const val KEY_WAKE_ENABLED = "wake_enabled"
        private const val KEY_SENSITIVITY = "sensitivity"
        private const val KEY_WAKE_PHRASE = "wake_phrase"
        private const val KEY_AUTO_LISTEN = "auto_listen_after_wake"
        private const val KEY_WAKE_SOUND = "wake_sound"
        private const val KEY_CONTINUOUS = "continuous_listening"
        private const val KEY_DETECTION_COUNT = "detection_count"
        private const val KEY_LAST_DETECTION = "last_detection_ms"
    }
}
