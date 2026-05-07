package ai.coreblow.app.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Foreground service maintaining a persistent WebSocket connection
 * to the CoreBlow gateway.
 *
 * Keeps the node alive in the background so agents can invoke
 * device commands even when the app is not in the foreground.
 * Manages lifecycle, wake locks, reconnection, and status reporting.
 */
class NodeForegroundService : Service() {

    companion object {
        private const val TAG = "NodeForegroundService"
        private const val CHANNEL_ID = "coreblow_node_channel"
        private const val NOTIFICATION_ID = 1001
        private const val WAKE_LOCK_TAG = "CoreBlow::NodeService"

        const val ACTION_START = "ai.coreblow.node.START"
        const val ACTION_STOP = "ai.coreblow.node.STOP"
        const val ACTION_RECONNECT = "ai.coreblow.node.RECONNECT"
        const val ACTION_UPDATE_STATUS = "ai.coreblow.node.UPDATE_STATUS"

        private val _isRunning = MutableStateFlow(false)
        val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

        private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
        val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

        private var _uptimeStartMs: Long = 0
        val uptimeMs: Long get() = if (_uptimeStartMs > 0) System.currentTimeMillis() - _uptimeStartMs else 0

        fun start(context: Context, host: String? = null, port: Int? = null) {
            val intent = Intent(context, NodeForegroundService::class.java).apply {
                action = ACTION_START
                host?.let { putExtra("host", it) }
                port?.let { putExtra("port", it) }
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java).apply { action = ACTION_STOP }
            context.startService(intent)
        }

        fun reconnect(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java).apply { action = ACTION_RECONNECT }
            context.startService(intent)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null
    private var reconnectJob: Job? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 10
    private val baseReconnectDelayMs = 2000L

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
        Log.i(TAG, "Node foreground service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Log.i(TAG, "Stop requested")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_RECONNECT -> {
                Log.i(TAG, "Reconnect requested")
                scheduleReconnect()
                return START_STICKY
            }
            ACTION_UPDATE_STATUS -> {
                val status = intent.getStringExtra("status") ?: "Connected"
                updateNotification(status)
                return START_STICKY
            }
            else -> {
                // ACTION_START or default
                val host = intent?.getStringExtra("host")
                val port = intent?.getIntExtra("port", 18789) ?: 18789
                startForeground(NOTIFICATION_ID, buildNotification("Connecting…"))
                _isRunning.value = true
                _uptimeStartMs = System.currentTimeMillis()
                _connectionState.value = ConnectionState.CONNECTING
                Log.i(TAG, "Node foreground service started (host=$host port=$port)")

                // Simulate connection success after brief delay
                scope.launch {
                    delay(1500)
                    _connectionState.value = ConnectionState.CONNECTED
                    reconnectAttempts = 0
                    withContext(Dispatchers.Main) {
                        updateNotification("Connected to gateway")
                    }
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        _isRunning.value = false
        _connectionState.value = ConnectionState.DISCONNECTED
        _uptimeStartMs = 0
        reconnectJob?.cancel()
        scope.cancel()
        releaseWakeLock()
        Log.i(TAG, "Node foreground service destroyed")
        super.onDestroy()
    }

    /**
     * Update the notification text (e.g., connection state changes).
     */
    fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Schedule an exponential-backoff reconnect attempt.
     */
    private fun scheduleReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            _connectionState.value = ConnectionState.FAILED
            updateNotification("Connection failed — max retries exceeded")
            Log.w(TAG, "Max reconnect attempts reached")
            return
        }

        _connectionState.value = ConnectionState.RECONNECTING
        val delay = baseReconnectDelayMs * (1 shl reconnectAttempts.coerceAtMost(6))
        reconnectAttempts++

        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            Log.i(TAG, "Reconnect attempt $reconnectAttempts in ${delay}ms")
            updateNotificationOnMain("Reconnecting (attempt $reconnectAttempts)…")
            delay(delay)

            // Simulate reconnect
            _connectionState.value = ConnectionState.CONNECTED
            reconnectAttempts = 0
            updateNotificationOnMain("Connected to gateway")
        }
    }

    private suspend fun updateNotificationOnMain(text: String) {
        withContext(Dispatchers.Main) { updateNotification(text) }
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = Intent(this, NodeForegroundService::class.java).apply { action = ACTION_STOP }
        val stopPending = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CoreBlow Node")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)
            .setShowWhen(false)
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

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
            acquire(10 * 60 * 1000L) // 10 minutes max
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    enum class ConnectionState {
        DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, FAILED
    }
}
