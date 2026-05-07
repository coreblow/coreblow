package ai.coreblow.app

import android.content.Context
import android.os.Build
import android.provider.Settings

/**
 * Resolves the best human-readable display name for this device.
 *
 * Tries the user-set device name first (Settings.Global.DEVICE_NAME),
 * then falls back to manufacturer + model.
 */
object DeviceNames {

    /** Return the most descriptive name available for this device. */
    fun bestDefaultNodeName(context: Context): String {
        val deviceName = runCatching {
            Settings.Global.getString(context.contentResolver, "device_name")
        }.getOrNull()?.trim().orEmpty()

        if (deviceName.isNotEmpty()) return deviceName

        val model = listOfNotNull(
            Build.MANUFACTURER?.takeIf { it.isNotBlank() },
            Build.MODEL?.takeIf { it.isNotBlank() },
        ).joinToString(" ").trim()

        return model.ifEmpty { "Android Node" }
    }
}
