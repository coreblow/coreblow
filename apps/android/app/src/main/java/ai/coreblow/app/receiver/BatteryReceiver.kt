package ai.coreblow.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.util.Log

/**
 * Receives battery state changes and forwards to the node runtime.
 */
class BatteryReceiver : BroadcastReceiver() {
    companion object { private const val TAG = "BatteryReceiver" }

    var onBatteryChanged: ((level: Int, isCharging: Boolean, source: String) -> Unit)? = null

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BATTERY_CHANGED) return
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
        val percent = if (scale > 0) (level * 100) / scale else -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        val source = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_AC -> "ac"
            BatteryManager.BATTERY_PLUGGED_USB -> "usb"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
            else -> "none"
        }
        Log.d(TAG, "Battery: $percent% charging=$isCharging source=$source")
        onBatteryChanged?.invoke(percent, isCharging, source)
    }
}

/**
 * Receives BOOT_COMPLETED to restart background services.
 */
class BootReceiver : BroadcastReceiver() {
    companion object { private const val TAG = "BootReceiver" }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i(TAG, "Device booted — scheduling background workers")
            // Re-enqueue periodic workers
            WorkerScheduler.scheduleAll(context)
        }
    }
}

/**
 * Receives connectivity changes and notifies the gateway session.
 */
class ConnectivityReceiver : BroadcastReceiver() {
    companion object { private const val TAG = "ConnectivityReceiver" }

    var onConnectivityChanged: ((isConnected: Boolean, type: String) -> Unit)? = null

    override fun onReceive(context: Context, intent: Intent) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val caps = if (network != null) cm.getNetworkCapabilities(network) else null
        val isConnected = caps != null
        val type = when {
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "wifi"
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "cellular"
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "ethernet"
            else -> "none"
        }
        Log.d(TAG, "Connectivity: connected=$isConnected type=$type")
        onConnectivityChanged?.invoke(isConnected, type)
    }
}

/**
 * Receives screen on/off events.
 */
class ScreenReceiver : BroadcastReceiver() {
    companion object { private const val TAG = "ScreenReceiver" }

    var onScreenStateChanged: ((isOn: Boolean) -> Unit)? = null

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SCREEN_ON -> {
                Log.d(TAG, "Screen ON")
                onScreenStateChanged?.invoke(true)
            }
            Intent.ACTION_SCREEN_OFF -> {
                Log.d(TAG, "Screen OFF")
                onScreenStateChanged?.invoke(false)
            }
        }
    }
}

/**
 * Receives notification posted/removed events via NotificationListenerService.
 */
class NotificationReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "NotificationReceiver"
        const val ACTION_NOTIFICATION_POSTED = "ai.coreblow.NOTIFICATION_POSTED"
        const val ACTION_NOTIFICATION_REMOVED = "ai.coreblow.NOTIFICATION_REMOVED"
    }

    var onNotificationPosted: ((packageName: String, title: String, text: String) -> Unit)? = null
    var onNotificationRemoved: ((packageName: String) -> Unit)? = null

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_NOTIFICATION_POSTED -> {
                val pkg = intent.getStringExtra("package") ?: return
                val title = intent.getStringExtra("title") ?: ""
                val text = intent.getStringExtra("text") ?: ""
                Log.d(TAG, "Notification posted: $pkg - $title")
                onNotificationPosted?.invoke(pkg, title, text)
            }
            ACTION_NOTIFICATION_REMOVED -> {
                val pkg = intent.getStringExtra("package") ?: return
                Log.d(TAG, "Notification removed: $pkg")
                onNotificationRemoved?.invoke(pkg)
            }
        }
    }
}

/**
 * Schedules all periodic WorkManager workers.
 */
object WorkerScheduler {
    fun scheduleAll(context: Context) {
        // Placeholder — actual scheduling done via WorkManager in Application.onCreate
        Log.i("WorkerScheduler", "Scheduling background workers")
    }
}
