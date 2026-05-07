package ai.coreblow.app.node

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.io.File
import java.util.Locale
import java.util.TimeZone

/**
 * Utility functions shared across node handlers.
 * Provides device identification, formatting, and common
 * data transformations used by multiple handlers.
 */
object NodeUtils {

    private const val TAG = "NodeUtils"

    /**
     * Get a stable device display name.
     */
    fun getDeviceDisplayName(context: Context): String {
        val btName = try {
            Settings.Secure.getString(context.contentResolver, "bluetooth_name")
        } catch (_: Throwable) { null }
        val deviceName = try {
            Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)
        } catch (_: Throwable) { null }
        return btName ?: deviceName ?: "${Build.MANUFACTURER} ${Build.MODEL}"
    }

    /**
     * Get the device model identifier string.
     */
    fun getModelIdentifier(): String {
        return "${Build.MANUFACTURER}/${Build.MODEL}/${Build.DEVICE}"
    }

    /**
     * Get locale info for gateway handshake.
     */
    fun getLocaleInfo(): String = buildJsonObject {
        val locale = Locale.getDefault()
        put("language", JsonPrimitive(locale.language))
        put("country", JsonPrimitive(locale.country))
        put("displayLanguage", JsonPrimitive(locale.displayLanguage))
        put("displayCountry", JsonPrimitive(locale.displayCountry))
        put("tag", JsonPrimitive(locale.toLanguageTag()))
        put("timezone", JsonPrimitive(TimeZone.getDefault().id))
        put("timezoneOffset", JsonPrimitive(TimeZone.getDefault().rawOffset / 60000))
    }.toString()

    /**
     * Truncate a string with ellipsis.
     */
    fun truncate(text: String, maxLength: Int = 200): String {
        return if (text.length > maxLength) text.take(maxLength - 1) + "…" else text
    }

    /**
     * Format bytes to human-readable string.
     */
    fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return "%.1f KB".format(kb)
        val mb = kb / 1024.0
        if (mb < 1024) return "%.1f MB".format(mb)
        val gb = mb / 1024.0
        return "%.2f GB".format(gb)
    }

    /**
     * Format duration in milliseconds to human-readable string.
     */
    fun formatDuration(ms: Long): String {
        val seconds = ms / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        return when {
            hours > 0 -> "${hours}h ${minutes % 60}m ${seconds % 60}s"
            minutes > 0 -> "${minutes}m ${seconds % 60}s"
            else -> "${seconds}s"
        }
    }

    /**
     * Sanitize a filename for safe storage.
     */
    fun sanitizeFilename(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(100)
    }

    /**
     * Check if the device is rooted (basic check).
     */
    fun isDeviceRooted(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
        )
        return paths.any { File(it).exists() }
    }

    /**
     * Get a unique request ID.
     */
    fun generateRequestId(): String {
        return java.util.UUID.randomUUID().toString()
    }

    /**
     * Safely parse an integer from a string with a default.
     */
    fun safeParseInt(value: String?, default: Int = 0): Int {
        return value?.trim()?.toIntOrNull() ?: default
    }

    /**
     * Safely parse a long from a string with a default.
     */
    fun safeParseLong(value: String?, default: Long = 0): Long {
        return value?.trim()?.toLongOrNull() ?: default
    }
}
