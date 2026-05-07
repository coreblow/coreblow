package ai.coreblow.app.node.handlers

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.serialization.json.*
import java.util.concurrent.atomic.AtomicInteger

/**
 * Handles notification-related gateway invoke commands.
 * Supports creating, updating, dismissing, and managing
 * notification channels and groups.
 */
class NotificationsHandler(private val context: Context) {

    companion object {
        private const val TAG = "NotificationsHandler"
        private const val DEFAULT_CHANNEL_ID = "coreblow_default"
        private const val AGENT_CHANNEL_ID = "coreblow_agent"
        private const val ALERT_CHANNEL_ID = "coreblow_alert"
        private val notificationIdCounter = AtomicInteger(2000)
    }

    private val activeNotifications = mutableMapOf<String, Int>() // tag -> id

    init { ensureChannels() }

    /**
     * Show a notification from gateway command.
     */
    fun showNotification(
        title: String,
        body: String,
        tag: String? = null,
        channel: String = DEFAULT_CHANNEL_ID,
        priority: String = "default",
        autoCancel: Boolean = true,
        group: String? = null,
        actions: List<NotifAction> = emptyList(),
    ): String {
        val id = tag?.let { activeNotifications[it] } ?: notificationIdCounter.getAndIncrement()
        val actualTag = tag ?: "notif_$id"

        val channelId = when (channel) {
            "agent" -> AGENT_CHANNEL_ID
            "alert" -> ALERT_CHANNEL_ID
            else -> DEFAULT_CHANNEL_ID
        }

        val builder = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(autoCancel)
            .setWhen(System.currentTimeMillis())
            .setPriority(mapPriority(priority))

        if (body.length > 40) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
        }

        group?.let {
            builder.setGroup(it)
        }

        // Add actions
        actions.take(3).forEach { action ->
            val intent = Intent("ai.coreblow.NOTIFICATION_ACTION").apply {
                putExtra("action_id", action.id)
                putExtra("notification_tag", actualTag)
            }
            val pending = PendingIntent.getBroadcast(
                context, action.id.hashCode(), intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            builder.addAction(0, action.label, pending)
        }

        try {
            NotificationManagerCompat.from(context).notify(actualTag, id, builder.build())
            activeNotifications[actualTag] = id
            Log.d(TAG, "Notification shown: $actualTag (id=$id)")
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission denied")
            return errorJson("Notification permission not granted")
        }

        return buildJsonObject {
            put("success", true)
            put("id", id)
            put("tag", actualTag)
        }.toString()
    }

    /**
     * Update an existing notification.
     */
    fun updateNotification(tag: String, title: String? = null, body: String? = null): String {
        val id = activeNotifications[tag] ?: return errorJson("Notification not found: $tag")
        return showNotification(
            title = title ?: "Updated",
            body = body ?: "",
            tag = tag,
        )
    }

    /**
     * Dismiss a notification by tag.
     */
    fun dismissNotification(tag: String): String {
        val id = activeNotifications.remove(tag)
        if (id != null) {
            NotificationManagerCompat.from(context).cancel(tag, id)
            Log.d(TAG, "Notification dismissed: $tag")
        }
        return buildJsonObject { put("dismissed", id != null); put("tag", tag) }.toString()
    }

    /**
     * Dismiss all active notifications.
     */
    fun dismissAll(): String {
        val count = activeNotifications.size
        NotificationManagerCompat.from(context).cancelAll()
        activeNotifications.clear()
        return buildJsonObject { put("dismissed", count) }.toString()
    }

    /**
     * Get all active notification tags.
     */
    fun getActiveNotifications(): String {
        return buildJsonObject {
            put("notifications", buildJsonArray {
                activeNotifications.forEach { (tag, id) ->
                    add(buildJsonObject { put("tag", tag); put("id", id) })
                }
            })
            put("count", activeNotifications.size)
        }.toString()
    }

    /**
     * Get notification channels.
     */
    fun getChannels(): String {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        return buildJsonObject {
            put("channels", buildJsonArray {
                nm.notificationChannels.forEach { ch ->
                    add(buildJsonObject {
                        put("id", ch.id)
                        put("name", ch.name.toString())
                        put("importance", ch.importance)
                        put("description", ch.description ?: "")
                    })
                }
            })
        }.toString()
    }

    /**
     * Show a progress notification.
     */
    fun showProgress(tag: String, title: String, progress: Int, max: Int = 100, indeterminate: Boolean = false): String {
        val id = activeNotifications[tag] ?: notificationIdCounter.getAndIncrement()

        val builder = NotificationCompat.Builder(context, DEFAULT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(if (indeterminate) "Processing…" else "$progress%")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setOngoing(true)
            .setProgress(max, progress, indeterminate)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        try {
            NotificationManagerCompat.from(context).notify(tag, id, builder.build())
            activeNotifications[tag] = id
        } catch (e: SecurityException) {
            return errorJson("Notification permission denied")
        }

        return buildJsonObject { put("success", true); put("tag", tag); put("progress", progress) }.toString()
    }

    // MARK: - Private

    private fun ensureChannels() {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(NotificationChannel(DEFAULT_CHANNEL_ID, "CoreBlow", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "General notifications"
        })
        nm.createNotificationChannel(NotificationChannel(AGENT_CHANNEL_ID, "Agent Messages", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Messages from AI agents"
            enableVibration(true)
        })
        nm.createNotificationChannel(NotificationChannel(ALERT_CHANNEL_ID, "Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Important alerts and warnings"
            enableLights(true)
            enableVibration(true)
        })
    }

    private fun mapPriority(priority: String): Int = when (priority.lowercase()) {
        "high", "urgent" -> NotificationCompat.PRIORITY_HIGH
        "low" -> NotificationCompat.PRIORITY_LOW
        "min" -> NotificationCompat.PRIORITY_MIN
        else -> NotificationCompat.PRIORITY_DEFAULT
    }

    private fun errorJson(msg: String) = buildJsonObject { put("error", msg) }.toString()
}

data class NotifAction(val id: String, val label: String)
