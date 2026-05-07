package ai.coreblow.app.gateway

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import java.security.MessageDigest
import java.util.UUID

/**
 * Manages a stable, unique device identity for gateway authentication.
 * Generates a device ID from hardware fingerprints with fallback to UUID.
 * Persists the identity across app reinstalls using SharedPreferences.
 */
object DeviceIdentityStore {

    private const val TAG = "DeviceIdentityStore"
    private const val PREFS_NAME = "coreblow_device_identity"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_DEVICE_NAME = "device_name"
    private const val KEY_CREATED_AT = "created_at"
    private const val KEY_FINGERPRINT = "fingerprint"
    private const val KEY_INSTALL_ID = "install_id"

    /**
     * Get or create a stable device ID.
     * Priority: persisted > hardware fingerprint > random UUID.
     */
    fun getOrCreateDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_DEVICE_ID, null)
        if (existing != null) return existing

        val deviceId = generateDeviceId(context)
        prefs.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putLong(KEY_CREATED_AT, System.currentTimeMillis())
            .putString(KEY_FINGERPRINT, generateFingerprint())
            .putString(KEY_INSTALL_ID, UUID.randomUUID().toString())
            .apply()

        Log.i(TAG, "New device ID created: ${deviceId.take(8)}…")
        return deviceId
    }

    /**
     * Get a human-readable device name.
     */
    fun getDeviceName(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val custom = prefs.getString(KEY_DEVICE_NAME, null)
        if (custom != null) return custom
        return "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}"
    }

    /**
     * Set a custom device name.
     */
    fun setDeviceName(context: Context, name: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_DEVICE_NAME, name.trim().take(50)).apply()
    }

    /**
     * Get the install-specific ID (changes on reinstall).
     */
    fun getInstallId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_INSTALL_ID, null)
        if (existing != null) return existing

        val installId = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALL_ID, installId).apply()
        return installId
    }

    /**
     * Get device metadata for gateway registration.
     */
    fun getDeviceMetadata(context: Context): Map<String, String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return mapOf(
            "deviceId" to getOrCreateDeviceId(context),
            "deviceName" to getDeviceName(context),
            "installId" to getInstallId(context),
            "manufacturer" to Build.MANUFACTURER,
            "model" to Build.MODEL,
            "brand" to Build.BRAND,
            "osVersion" to Build.VERSION.RELEASE,
            "sdkInt" to Build.VERSION.SDK_INT.toString(),
            "fingerprint" to (prefs.getString(KEY_FINGERPRINT, "") ?: ""),
            "createdAt" to (prefs.getLong(KEY_CREATED_AT, 0)).toString(),
        )
    }

    /**
     * Check if the hardware fingerprint has changed (possible device migration).
     */
    fun hasHardwareChanged(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val stored = prefs.getString(KEY_FINGERPRINT, null) ?: return false
        return stored != generateFingerprint()
    }

    /**
     * Reset identity (use with caution — changes device ID on gateway).
     */
    fun resetIdentity(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().clear().apply()
        Log.w(TAG, "Device identity reset")
    }

    // MARK: - Private

    @Suppress("DEPRECATION")
    private fun generateDeviceId(context: Context): String {
        // Try Android ID first
        val androidId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        } catch (_: Exception) { null }

        // Combine with hardware info for stability
        val seed = listOfNotNull(
            androidId,
            Build.BOARD,
            Build.BRAND,
            Build.DEVICE,
            Build.HARDWARE,
            Build.MANUFACTURER,
            Build.MODEL,
            Build.PRODUCT,
            Build.SERIAL.takeIf { it != Build.UNKNOWN },
        ).joinToString("|")

        return if (seed.isNotBlank()) {
            sha256(seed).take(32)
        } else {
            UUID.randomUUID().toString().replace("-", "").take(32)
        }
    }

    private fun generateFingerprint(): String {
        val data = "${Build.BOARD}|${Build.BRAND}|${Build.DEVICE}|${Build.HARDWARE}|${Build.MANUFACTURER}|${Build.MODEL}"
        return sha256(data).take(16)
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
