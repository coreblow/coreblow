package ai.coreblow.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

// ============================================================
// ChatService — foreground service for maintaining chat connections
// ============================================================

class ChatService : Service() {
    companion object {
        private const val TAG = "ChatService"
        private const val CHANNEL_ID = "coreblow_chat"
        private const val NOTIFICATION_ID = 1001
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        createChannel()
        Log.i(TAG, "ChatService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Connected"))
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun buildNotification(status: String): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("CoreBlow")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("CoreBlow")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Chat Service", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }
}

// ============================================================
// SyncService — handles background data synchronization
// ============================================================

class SyncService : Service() {
    companion object { private const val TAG = "SyncService" }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Sync started")
        // Perform sync in background
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { scope.cancel(); super.onDestroy() }
}

// ============================================================
// NotificationService — manages notification lifecycle
// ============================================================

class NotificationService : Service() {
    companion object { private const val TAG = "NotificationService" }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.getStringExtra("action")
        val title = intent?.getStringExtra("title") ?: "CoreBlow"
        val body = intent?.getStringExtra("body") ?: ""

        when (action) {
            "post" -> postNotification(title, body)
            "cancel" -> cancelNotification(intent.getIntExtra("id", 0))
            "cancelAll" -> cancelAll()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun postNotification(title: String, body: String) {
        Log.d("NotificationService", "Posting: $title")
    }
    private fun cancelNotification(id: Int) {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).cancel(id)
    }
    private fun cancelAll() {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).cancelAll()
    }
}

// ============================================================
// AnalyticsService — event tracking
// ============================================================

class AnalyticsService : Service() {
    companion object {
        private const val TAG = "AnalyticsService"
        private val events = mutableListOf<AnalyticsEvent>()

        fun trackEvent(name: String, params: Map<String, String> = emptyMap()) {
            events.add(AnalyticsEvent(name, params, System.currentTimeMillis()))
            if (events.size > 500) events.removeAt(0) // Ring buffer
        }
        fun getEvents(): List<AnalyticsEvent> = events.toList()
        fun clearEvents() = events.clear()
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY
}

data class AnalyticsEvent(val name: String, val params: Map<String, String>, val timestampMs: Long)

// ============================================================
// UpdateService — app update checks
// ============================================================

class UpdateService : Service() {
    companion object {
        private const val TAG = "UpdateService"
        var latestVersion: String? = null
        var updateAvailable: Boolean = false
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Checking for updates")
        return START_NOT_STICKY
    }
}
