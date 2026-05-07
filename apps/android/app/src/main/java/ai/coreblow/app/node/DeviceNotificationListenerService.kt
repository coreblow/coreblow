package ai.coreblow.app.node

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * System notification listener that forwards device notifications
 * to the gateway as node events. Requires user to grant
 * notification access in system settings.
 */
class DeviceNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "CoreBlowNotifListener"
        private const val MAX_TEXT_LENGTH = 500

        @Volatile
        private var nodeEventSink: ((event: String, payloadJson: String) -> Unit)? = null

        fun setNodeEventSink(sink: (event: String, payloadJson: String) -> Unit) {
            nodeEventSink = sink
        }

        fun clearNodeEventSink() {
            nodeEventSink = null
        }

        fun isEnabled(context: Context): Boolean {
            val flat = android.provider.Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners",
            ) ?: return false
            val component = ComponentName(context, DeviceNotificationListenerService::class.java)
            return flat.contains(component.flattenToString())
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val sink = nodeEventSink ?: return

        try {
            val notification = sbn.notification ?: return
            val extras = notification.extras ?: Bundle()

            val packageName = sbn.packageName ?: ""
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
            val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim().orEmpty()
            val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()?.trim().orEmpty()

            // Skip empty notifications
            if (title.isEmpty() && text.isEmpty() && bigText.isEmpty()) return

            // Skip our own notifications
            if (packageName == applicationContext.packageName) return

            val category = notification.category?.trim().orEmpty()
            val isOngoing = (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0
            val priority = notification.priority
            val postTime = sbn.postTime

            val payload = buildJsonObject {
                put("packageName", JsonPrimitive(packageName))
                put("title", JsonPrimitive(title.take(MAX_TEXT_LENGTH)))
                put("text", JsonPrimitive(text.take(MAX_TEXT_LENGTH)))
                if (bigText.isNotEmpty() && bigText != text) {
                    put("bigText", JsonPrimitive(bigText.take(MAX_TEXT_LENGTH)))
                }
                if (subText.isNotEmpty()) {
                    put("subText", JsonPrimitive(subText.take(MAX_TEXT_LENGTH)))
                }
                put("category", JsonPrimitive(category.ifEmpty { "unknown" }))
                put("isOngoing", JsonPrimitive(isOngoing))
                put("priority", JsonPrimitive(priority))
                put("postTimeMs", JsonPrimitive(postTime))
                put("key", JsonPrimitive(sbn.key ?: ""))
                put("id", JsonPrimitive(sbn.id))
                put("tag", JsonPrimitive(sbn.tag ?: ""))
            }

            sink("device.notification.posted", payload.toString())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to process posted notification: ${e.message}")
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val sink = nodeEventSink ?: return

        try {
            val packageName = sbn.packageName ?: ""
            if (packageName == applicationContext.packageName) return

            val payload = buildJsonObject {
                put("packageName", JsonPrimitive(packageName))
                put("key", JsonPrimitive(sbn.key ?: ""))
                put("id", JsonPrimitive(sbn.id))
                put("tag", JsonPrimitive(sbn.tag ?: ""))
                put("removedAtMs", JsonPrimitive(System.currentTimeMillis()))
            }

            sink("device.notification.removed", payload.toString())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to process removed notification: ${e.message}")
        }
    }

    override fun onListenerConnected() {
        Log.i(TAG, "Notification listener connected")
    }

    override fun onListenerDisconnected() {
        Log.i(TAG, "Notification listener disconnected")
        requestRebind(ComponentName(this, DeviceNotificationListenerService::class.java))
    }

    /**
     * Get currently active notifications as a summary.
     */
    fun getActiveNotificationsSummary(): String {
        return try {
            val active = activeNotifications ?: return "[]"
            val summaries = active.mapNotNull { sbn ->
                val extras = sbn.notification?.extras ?: return@mapNotNull null
                val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
                val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
                if (title.isEmpty() && text.isEmpty()) return@mapNotNull null
                buildJsonObject {
                    put("package", JsonPrimitive(sbn.packageName ?: ""))
                    put("title", JsonPrimitive(title.take(MAX_TEXT_LENGTH)))
                    put("text", JsonPrimitive(text.take(MAX_TEXT_LENGTH)))
                    put("postTimeMs", JsonPrimitive(sbn.postTime))
                }
            }
            kotlinx.serialization.json.JsonArray(summaries).toString()
        } catch (_: Exception) { "[]" }
    }
}
