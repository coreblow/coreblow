package ai.coreblow.app.node

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Utility functions for the node subsystem.
 */
object NodeUtils {

    /**
     * Check if a runtime permission is granted.
     */
    fun hasPermission(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Build a user-agent string for gateway handshake.
     */
    fun buildUserAgent(context: Context): String {
        val appVersion = try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
        } catch (_: Exception) { "unknown" }

        return "CoreBlow-Android/$appVersion (${Build.MANUFACTURER} ${Build.MODEL}; Android ${Build.VERSION.RELEASE})"
    }

    /**
     * Generate a display name for this device.
     */
    fun deviceDisplayName(): String {
        val brand = Build.BRAND.replaceFirstChar { it.uppercase() }
        return "$brand ${Build.MODEL}"
    }

    /**
     * Format bytes to human-readable string.
     */
    fun formatBytes(bytes: Long): String {
        return when {
            bytes >= 1_073_741_824 -> "%.1f GB".format(bytes / 1_073_741_824.0)
            bytes >= 1_048_576 -> "%.1f MB".format(bytes / 1_048_576.0)
            bytes >= 1_024 -> "%.1f KB".format(bytes / 1_024.0)
            else -> "$bytes B"
        }
    }

    /**
     * Truncate a string with ellipsis if it exceeds max length.
     */
    fun truncate(text: String, maxLength: Int = 100): String {
        return if (text.length > maxLength) text.take(maxLength - 1) + "…" else text
    }
}
