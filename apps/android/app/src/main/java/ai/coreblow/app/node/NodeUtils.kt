package ai.coreblow.app.node

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.util.Log
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Utility functions shared across node handlers.
 * Provides device identification, formatting, encoding,
 * and common data transformations used by multiple handlers.
 */
object NodeUtils {

    private const val TAG = "NodeUtils"
    private val ISO_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    // ── Device Identity ─────────────────────────────────────

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
     * Get full device info JSON.
     */
    fun getDeviceInfo(): String = buildJsonObject {
        put("manufacturer", Build.MANUFACTURER)
        put("model", Build.MODEL)
        put("device", Build.DEVICE)
        put("brand", Build.BRAND)
        put("board", Build.BOARD)
        put("hardware", Build.HARDWARE)
        put("product", Build.PRODUCT)
        put("osVersion", Build.VERSION.RELEASE)
        put("sdkInt", Build.VERSION.SDK_INT)
        put("buildId", Build.ID)
        put("isEmulator", isEmulator())
        put("isRooted", isDeviceRooted())
    }.toString()

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
        put("is24Hour", JsonPrimitive(android.text.format.DateFormat.is24HourFormat(null)))
    }.toString()

    // ── Formatting ──────────────────────────────────────────

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
            seconds > 0 -> "${seconds}s"
            else -> "${ms}ms"
        }
    }

    /**
     * Format a timestamp as ISO-8601.
     */
    fun formatIso(timestampMs: Long): String = ISO_FORMAT.format(Date(timestampMs))

    /**
     * Format a timestamp as relative time.
     */
    fun formatRelative(timestampMs: Long): String {
        val diffMs = System.currentTimeMillis() - timestampMs
        return when {
            diffMs < 60_000 -> "just now"
            diffMs < 3_600_000 -> "${diffMs / 60_000}m ago"
            diffMs < 86_400_000 -> "${diffMs / 3_600_000}h ago"
            else -> "${diffMs / 86_400_000}d ago"
        }
    }

    // ── File/Path Utilities ─────────────────────────────────

    /**
     * Sanitize a filename for safe storage.
     */
    fun sanitizeFilename(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(100)
    }

    /**
     * Get a unique temp file path.
     */
    fun getTempFile(context: Context, prefix: String = "cb", suffix: String = ".tmp"): File {
        val dir = File(context.cacheDir, "coreblow_temp")
        dir.mkdirs()
        return File(dir, "${prefix}_${System.currentTimeMillis()}$suffix")
    }

    /**
     * Clean old temp files.
     */
    fun cleanTempFiles(context: Context, maxAgeMs: Long = 24 * 60 * 60 * 1000) {
        val dir = File(context.cacheDir, "coreblow_temp")
        if (!dir.exists()) return
        val cutoff = System.currentTimeMillis() - maxAgeMs
        dir.listFiles()?.filter { it.lastModified() < cutoff }?.forEach { file ->
            if (file.delete()) Log.d(TAG, "Cleaned temp: ${file.name}")
        }
    }

    // ── Encoding ────────────────────────────────────────────

    /**
     * Base64 encode a byte array.
     */
    fun base64Encode(data: ByteArray): String = Base64.encodeToString(data, Base64.NO_WRAP)

    /**
     * Base64 decode a string.
     */
    fun base64Decode(data: String): ByteArray = Base64.decode(data, Base64.DEFAULT)

    /**
     * SHA-256 hash a string.
     */
    fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    // ── Security Checks ─────────────────────────────────────

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
     * Check if running in an emulator.
     */
    @Suppress("DEPRECATION")
    fun isEmulator(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
            Build.FINGERPRINT.startsWith("unknown") ||
            Build.MODEL.contains("Emulator") ||
            Build.MODEL.contains("Android SDK") ||
            Build.MANUFACTURER.contains("Genymotion") ||
            Build.BRAND.startsWith("generic") ||
            Build.DEVICE.startsWith("generic") ||
            Build.HARDWARE == "goldfish" ||
            Build.HARDWARE == "ranchu" ||
            Build.PRODUCT == "sdk_google" ||
            Build.PRODUCT.startsWith("sdk")
    }

    // ── ID Generation ───────────────────────────────────────

    /**
     * Get a unique request ID.
     */
    fun generateRequestId(): String = UUID.randomUUID().toString()

    /**
     * Get a short unique ID (8 chars).
     */
    fun generateShortId(): String = UUID.randomUUID().toString().take(8)

    /**
     * Generate a timestamped ID.
     */
    fun generateTimestampedId(prefix: String = "cb"): String {
        return "${prefix}_${System.currentTimeMillis()}_${generateShortId()}"
    }

    // ── Parsing ─────────────────────────────────────────────

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

    /**
     * Safely parse a double from a string with a default.
     */
    fun safeParseDouble(value: String?, default: Double = 0.0): Double {
        return value?.trim()?.toDoubleOrNull() ?: default
    }

    /**
     * Safely parse a boolean from a string.
     */
    fun safeParseBool(value: String?, default: Boolean = false): Boolean {
        return when (value?.trim()?.lowercase()) {
            "true", "1", "yes", "on" -> true
            "false", "0", "no", "off" -> false
            else -> default
        }
    }
}
