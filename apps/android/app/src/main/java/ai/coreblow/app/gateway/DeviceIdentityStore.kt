package ai.coreblow.app.gateway

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.util.UUID

/**
 * Manages the persistent device identity used during gateway pairing.
 *
 * Generates a stable device UUID on first run and provides device metadata
 * (model name, OS version, display name) for the gateway handshake.
 */
class DeviceIdentityStore(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "coreblow_device_identity"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DISPLAY_NAME = "display_name"
    }

    private val prefs by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Get or generate the stable device UUID.
     * Persists across app restarts but not reinstalls.
     */
    val deviceId: String
        get() {
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                id = UUID.randomUUID().toString()
                prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            return id
        }

    /**
     * User-configurable device display name shown in the gateway dashboard.
     */
    var displayName: String
        get() = prefs.getString(KEY_DISPLAY_NAME, null) ?: defaultDisplayName
        set(value) {
            prefs.edit().putString(KEY_DISPLAY_NAME, value).apply()
        }

    /**
     * The Android device model identifier (e.g., "Pixel 8 Pro").
     */
    val modelIdentifier: String
        get() = Build.MODEL

    /**
     * The device manufacturer (e.g., "Google").
     */
    val manufacturer: String
        get() = Build.MANUFACTURER

    /**
     * The device family classification.
     */
    val deviceFamily: String
        get() = when {
            isTablet -> "tablet"
            isTv -> "tv"
            isAutomotive -> "automotive"
            isWear -> "watch"
            else -> "phone"
        }

    /**
     * The Android OS version string (e.g., "14").
     */
    val osVersion: String
        get() = Build.VERSION.RELEASE

    /**
     * The full platform identifier sent during handshake (e.g., "android-14").
     */
    val platformIdentifier: String
        get() = "${CoreBlowProtocol.PLATFORM_ANDROID}-${Build.VERSION.RELEASE}"

    /**
     * Build a [GatewayClientInfo] from this device's identity.
     */
    fun toClientInfo(appVersion: String): GatewayClientInfo {
        return GatewayClientInfo(
            id = deviceId,
            displayName = displayName,
            version = appVersion,
            platform = platformIdentifier,
            mode = CoreBlowProtocol.MODE_FULL,
            instanceId = deviceId,
            deviceFamily = deviceFamily,
            modelIdentifier = modelIdentifier,
        )
    }

    private val defaultDisplayName: String
        get() {
            val brand = Build.BRAND.replaceFirstChar { it.uppercase() }
            return "$brand ${Build.MODEL}"
        }

    private val isTablet: Boolean
        get() {
            val metrics = context.resources.displayMetrics
            val widthDp = metrics.widthPixels / metrics.density
            return widthDp >= 600
        }

    private val isTv: Boolean
        get() = context.packageManager.hasSystemFeature("android.software.leanback")

    private val isAutomotive: Boolean
        get() = context.packageManager.hasSystemFeature("android.hardware.type.automotive")

    private val isWear: Boolean
        get() = context.packageManager.hasSystemFeature("android.hardware.type.watch")
}
