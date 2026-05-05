package ai.coreblow.app.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service maintaining a persistent WebSocket connection
 * to the CoreBlow gateway.
 *
 * Keeps the node alive in the background so agents can invoke
 * device commands even when the app is not in the foreground.
 */
class NodeForegroundService : Service() {

    companion object {
        private const val TAG = "NodeForegroundService"
        private const val CHANNEL_ID = "coreblow_node_channel"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java)
            context.stopService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.i(TAG, "Node foreground service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification("Connected to gateway")
        startForeground(NOTIFICATION_ID, notification)
        Log.i(TAG, "Node foreground service started")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "Node foreground service destroyed")
    }

    /**
     * Update the notification text (e.g., connection state changes).
     */
    fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CoreBlow Node")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "CoreBlow Node Connection",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Maintains connection to CoreBlow gateway"
            setShowBadge(false)
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }
}
