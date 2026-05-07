package ai.coreblow.app.node.handlers

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Handles local notification dispatch for gateway invoke commands.
 * Manages notification channels, permission checks, and notification posting.
 */
class NotificationsHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "NotificationsHandler"
        private const val DEFAULT_CHANNEL_ID = "coreblow_default"
        private const val DEFAULT_CHANNEL_NAME = "CoreBlow"
        private var notificationId = 1000
    }

    init {
        createDefaultChannel()
    }

    fun postNotification(title: String, body: String, channelId: String? = null): String {
        val channel = channelId ?: DEFAULT_CHANNEL_ID

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                return buildJsonObject {
                    put("success", JsonPrimitive(false))
                    put("error", JsonPrimitive("Notification permission not granted"))
                }.toString()
            }
        }

        val id = notificationId++
        val notification = NotificationCompat.Builder(appContext, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(appContext).notify(id, notification)
        } catch (e: SecurityException) {
            return buildJsonObject {
                put("success", JsonPrimitive(false))
                put("error", JsonPrimitive("Permission denied"))
            }.toString()
        }

        return buildJsonObject {
            put("success", JsonPrimitive(true))
            put("notificationId", JsonPrimitive(id))
        }.toString()
    }

    fun cancelNotification(id: Int) {
        NotificationManagerCompat.from(appContext).cancel(id)
    }

    fun cancelAll() {
        NotificationManagerCompat.from(appContext).cancelAll()
    }

    fun hasPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else true
    }

    fun getChannels(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return "[]"
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channels = nm.notificationChannels.map { ch ->
            buildJsonObject {
                put("id", JsonPrimitive(ch.id))
                put("name", JsonPrimitive(ch.name.toString()))
                put("importance", JsonPrimitive(ch.importance))
            }
        }
        return kotlinx.serialization.json.JsonArray(channels).toString()
    }

    private fun createDefaultChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(DEFAULT_CHANNEL_ID, DEFAULT_CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = "CoreBlow notifications"
            val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
}
