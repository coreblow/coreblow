package ai.coreblow.app.node.handlers

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Handles device info, battery, network, storage, display, and
 * system settings queries for gateway invoke commands.
 */
class DeviceHandler(private val appContext: Context) {

    fun getDeviceInfo(): String = buildJsonObject {
        put("manufacturer", JsonPrimitive(Build.MANUFACTURER))
        put("model", JsonPrimitive(Build.MODEL))
        put("brand", JsonPrimitive(Build.BRAND))
        put("device", JsonPrimitive(Build.DEVICE))
        put("product", JsonPrimitive(Build.PRODUCT))
        put("hardware", JsonPrimitive(Build.HARDWARE))
        put("board", JsonPrimitive(Build.BOARD))
        put("fingerprint", JsonPrimitive(Build.FINGERPRINT))
        put("sdkInt", JsonPrimitive(Build.VERSION.SDK_INT))
        put("release", JsonPrimitive(Build.VERSION.RELEASE))
        put("platform", JsonPrimitive("android"))
        put("abis", JsonPrimitive(Build.SUPPORTED_ABIS.joinToString(",")))
        put("bootloader", JsonPrimitive(Build.BOOTLOADER))
        put("isEmulator", JsonPrimitive(
            Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("Emulator") || Build.MANUFACTURER.contains("Genymotion")
        ))
        put("securityPatch", JsonPrimitive(Build.VERSION.SECURITY_PATCH))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            put("mediaPerformanceClass", JsonPrimitive(Build.VERSION.MEDIA_PERFORMANCE_CLASS))
        }
    }.toString()

    fun getBatteryInfo(): String {
        val intent = appContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val health = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
        val temperature = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0
        val voltage = intent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) ?: 0
        val technology = intent?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY) ?: ""

        val percent = if (scale > 0) (level * 100) / scale else -1

        return buildJsonObject {
            put("level", JsonPrimitive(percent))
            put("isCharging", JsonPrimitive(status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL))
            put("isFull", JsonPrimitive(status == BatteryManager.BATTERY_STATUS_FULL))
            put("chargingSource", JsonPrimitive(when (plugged) {
                BatteryManager.BATTERY_PLUGGED_AC -> "ac"
                BatteryManager.BATTERY_PLUGGED_USB -> "usb"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
                else -> "none"
            }))
            put("health", JsonPrimitive(when (health) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
                BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "overVoltage"
                else -> "unknown"
            }))
            put("temperatureC", JsonPrimitive(temperature / 10.0))
            put("voltageV", JsonPrimitive(voltage / 1000.0))
            put("technology", JsonPrimitive(technology))
        }.toString()
    }

    fun getNetworkInfo(): String {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val caps = if (network != null) cm.getNetworkCapabilities(network) else null

        return buildJsonObject {
            put("isConnected", JsonPrimitive(caps != null))
            put("hasWifi", JsonPrimitive(caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true))
            put("hasCellular", JsonPrimitive(caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true))
            put("hasEthernet", JsonPrimitive(caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true))
            put("hasVpn", JsonPrimitive(caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true))
            put("isMetered", JsonPrimitive(cm.isActiveNetworkMetered))
            if (caps != null) {
                put("downstreamBandwidthKbps", JsonPrimitive(caps.linkDownstreamBandwidthKbps))
                put("upstreamBandwidthKbps", JsonPrimitive(caps.linkUpstreamBandwidthKbps))
                put("isNotRestricted", JsonPrimitive(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)))
            }
        }.toString()
    }

    fun getStorageInfo(): String {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        val totalBytes = stat.totalBytes
        val freeBytes = stat.availableBytes

        val am = appContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)

        return buildJsonObject {
            put("storageTotalMb", JsonPrimitive(totalBytes / (1024 * 1024)))
            put("storageFreeMb", JsonPrimitive(freeBytes / (1024 * 1024)))
            put("storageUsedPercent", JsonPrimitive(((totalBytes - freeBytes) * 100) / totalBytes))
            put("ramTotalMb", JsonPrimitive(memInfo.totalMem / (1024 * 1024)))
            put("ramAvailableMb", JsonPrimitive(memInfo.availMem / (1024 * 1024)))
            put("isLowMemory", JsonPrimitive(memInfo.lowMemory))
            put("ramThresholdMb", JsonPrimitive(memInfo.threshold / (1024 * 1024)))
        }.toString()
    }

    fun getDisplayInfo(): String {
        val wm = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val dm = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(dm)

        return buildJsonObject {
            put("widthPx", JsonPrimitive(dm.widthPixels))
            put("heightPx", JsonPrimitive(dm.heightPixels))
            put("density", JsonPrimitive(dm.density.toDouble()))
            put("densityDpi", JsonPrimitive(dm.densityDpi))
            put("scaledDensity", JsonPrimitive(dm.scaledDensity.toDouble()))
            put("xdpi", JsonPrimitive(dm.xdpi.toDouble()))
            put("ydpi", JsonPrimitive(dm.ydpi.toDouble()))
        }.toString()
    }

    fun getSystemSettings(): String {
        val cr = appContext.contentResolver
        return buildJsonObject {
            put("airplaneMode", JsonPrimitive(Settings.Global.getInt(cr, Settings.Global.AIRPLANE_MODE_ON, 0) == 1))
            put("autoRotate", JsonPrimitive(Settings.System.getInt(cr, Settings.System.ACCELEROMETER_ROTATION, 0) == 1))
            put("screenBrightness", JsonPrimitive(Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS, 128)))
            put("screenTimeout", JsonPrimitive(Settings.System.getInt(cr, Settings.System.SCREEN_OFF_TIMEOUT, 30000)))
            put("developerMode", JsonPrimitive(Settings.Global.getInt(cr, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1))
            put("bluetoothName", JsonPrimitive(Settings.Secure.getString(cr, "bluetooth_name") ?: ""))
            put("deviceName", JsonPrimitive(Settings.Global.getString(cr, Settings.Global.DEVICE_NAME) ?: Build.MODEL))
        }.toString()
    }

    /**
     * Handle namespaced sub-commands (e.g. device.uptime).
     */
    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return when (subCommand) {
            "info" -> getDeviceInfo()
            "battery" -> getBatteryInfo()
            "network" -> getNetworkInfo()
            "storage" -> getStorageInfo()
            "display" -> getDisplayInfo()
            "settings" -> getSystemSettings()
            "uptime" -> buildJsonObject {
                put("uptimeMs", JsonPrimitive(android.os.SystemClock.elapsedRealtime()))
                put("uptimeMinutes", JsonPrimitive(android.os.SystemClock.elapsedRealtime() / 60_000))
            }.toString()
            else -> null
        }
    }
}
