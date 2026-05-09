package ai.coreblow.app.node.handlers

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.content.ContextCompat
import ai.coreblow.app.BuildConfig
import ai.coreblow.app.gateway.GatewaySession
import ai.coreblow.app.node.DeviceNotificationListenerService
import java.util.Locale
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Handles device info, status, permissions, and health queries
 * for gateway invoke commands.
 *
 * Exposes battery, storage, network, memory, thermal, and permission
 * snapshots using Android system services.
 */
class DeviceHandler(
    private val appContext: Context,
    private val smsEnabled: Boolean = BuildConfig.COREBLOW_ENABLE_SMS,
    private val callLogEnabled: Boolean = BuildConfig.COREBLOW_ENABLE_CALL_LOG,
) {
    // ── Gateway handlers ────────────────────────────────

    fun handleDeviceStatus(_paramsJson: String?): GatewaySession.InvokeResult =
        GatewaySession.InvokeResult.ok(statusPayloadJson())

    fun handleDeviceInfo(_paramsJson: String?): GatewaySession.InvokeResult =
        GatewaySession.InvokeResult.ok(infoPayloadJson())

    fun handleDevicePermissions(_paramsJson: String?): GatewaySession.InvokeResult =
        GatewaySession.InvokeResult.ok(permissionsPayloadJson())

    fun handleDeviceHealth(_paramsJson: String?): GatewaySession.InvokeResult =
        GatewaySession.InvokeResult.ok(healthPayloadJson())

    // ── Status payload ──────────────────────────────────

    private fun statusPayloadJson(): String {
        val battery = readBatterySnapshot()
        val powerManager = appContext.getSystemService(PowerManager::class.java)
        val storage = StatFs(Environment.getDataDirectory().absolutePath)
        val totalBytes = storage.totalBytes
        val freeBytes = storage.availableBytes
        val usedBytes = (totalBytes - freeBytes).coerceAtLeast(0L)
        val connectivity = appContext.getSystemService(ConnectivityManager::class.java)
        val activeNetwork = connectivity?.activeNetwork
        val caps = activeNetwork?.let { connectivity.getNetworkCapabilities(it) }
        val uptimeSeconds = SystemClock.elapsedRealtime() / 1_000.0

        return buildJsonObject {
            put("battery", buildJsonObject {
                battery.levelFraction?.let { put("level", JsonPrimitive(it)) }
                put("state", JsonPrimitive(mapBatteryState(battery.status)))
                put("lowPowerModeEnabled", JsonPrimitive(powerManager?.isPowerSaveMode == true))
            })
            put("thermal", buildJsonObject {
                put("state", JsonPrimitive(mapThermalState(powerManager)))
            })
            put("storage", buildJsonObject {
                put("totalBytes", JsonPrimitive(totalBytes))
                put("freeBytes", JsonPrimitive(freeBytes))
                put("usedBytes", JsonPrimitive(usedBytes))
            })
            put("network", buildJsonObject {
                put("status", JsonPrimitive(mapNetworkStatus(caps)))
                put("isExpensive", JsonPrimitive(caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)?.not() ?: false))
                put("isConstrained", JsonPrimitive(caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)?.not() ?: false))
                put("interfaces", networkInterfacesJson(caps))
            })
            put("uptimeSeconds", JsonPrimitive(uptimeSeconds))
        }.toString()
    }

    // ── Info payload ────────────────────────────────────

    private fun infoPayloadJson(): String {
        val model = Build.MODEL?.trim().orEmpty()
        val manufacturer = Build.MANUFACTURER?.trim().orEmpty()
        val modelIdentifier = Build.DEVICE?.trim().orEmpty()
        val systemVersion = Build.VERSION.RELEASE?.trim().orEmpty()
        val locale = Locale.getDefault().toLanguageTag().trim()
        val appVersion = BuildConfig.VERSION_NAME.trim()
        val appBuild = BuildConfig.VERSION_CODE.toString()

        return buildJsonObject {
            put("deviceName", JsonPrimitive(model.ifEmpty { "Android" }))
            put("modelIdentifier", JsonPrimitive(modelIdentifier.ifEmpty { listOf(manufacturer, model).filter { it.isNotEmpty() }.joinToString(" ") }))
            put("systemName", JsonPrimitive("Android"))
            put("systemVersion", JsonPrimitive(systemVersion.ifEmpty { Build.VERSION.SDK_INT.toString() }))
            put("appVersion", JsonPrimitive(appVersion.ifEmpty { "dev" }))
            put("appBuild", JsonPrimitive(appBuild.ifEmpty { "0" }))
            put("locale", JsonPrimitive(locale.ifEmpty { Locale.getDefault().toString() }))
        }.toString()
    }

    // ── Permissions payload ─────────────────────────────

    private fun permissionsPayloadJson(): String {
        val canSendSms = appContext.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
        val notificationAccess = DeviceNotificationListenerService.isAccessEnabled(appContext)
        val photosGranted = if (Build.VERSION.SDK_INT >= 33) hasPermission(Manifest.permission.READ_MEDIA_IMAGES)
        else hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
        val motionGranted = hasPermission(Manifest.permission.ACTIVITY_RECOGNITION)
        val notificationsGranted = if (Build.VERSION.SDK_INT >= 33) hasPermission(Manifest.permission.POST_NOTIFICATIONS) else true

        return buildJsonObject {
            put("permissions", buildJsonObject {
                put("camera", permissionStateJson(hasPermission(Manifest.permission.CAMERA), true))
                put("microphone", permissionStateJson(hasPermission(Manifest.permission.RECORD_AUDIO), true))
                put("location", permissionStateJson(
                    hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) || hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION), true,
                ))
                put("sms", permissionStateJson(smsEnabled && hasPermission(Manifest.permission.SEND_SMS) && canSendSms, smsEnabled && canSendSms))
                put("notificationListener", permissionStateJson(notificationAccess, true))
                put("notifications", permissionStateJson(notificationsGranted, true))
                put("photos", permissionStateJson(photosGranted, true))
                put("contacts", permissionStateJson(hasPermission(Manifest.permission.READ_CONTACTS), true))
                put("calendar", permissionStateJson(hasPermission(Manifest.permission.READ_CALENDAR), true))
                put("callLog", permissionStateJson(callLogEnabled && hasPermission(Manifest.permission.READ_CALL_LOG), callLogEnabled))
                put("motion", permissionStateJson(motionGranted, true))
            })
        }.toString()
    }

    // ── Health payload ──────────────────────────────────

    private fun healthPayloadJson(): String {
        val battery = readBatterySnapshot()
        val batteryManager = appContext.getSystemService(BatteryManager::class.java)
        val currentNowUa = batteryManager?.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
        val currentNowMa = if (currentNowUa == null || currentNowUa == Long.MIN_VALUE) null else currentNowUa.toDouble() / 1_000.0

        val powerManager = appContext.getSystemService(PowerManager::class.java)
        val activityManager = appContext.getSystemService(ActivityManager::class.java)
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager?.getMemoryInfo(memoryInfo)
        val totalRamBytes = memoryInfo.totalMem.coerceAtLeast(0L)
        val availableRamBytes = memoryInfo.availMem.coerceAtLeast(0L)
        val usedRamBytes = (totalRamBytes - availableRamBytes).coerceAtLeast(0L)
        val memoryPressure = mapMemoryPressure(totalRamBytes, availableRamBytes, memoryInfo.lowMemory)

        return buildJsonObject {
            put("memory", buildJsonObject {
                put("pressure", JsonPrimitive(memoryPressure))
                put("totalRamBytes", JsonPrimitive(totalRamBytes))
                put("availableRamBytes", JsonPrimitive(availableRamBytes))
                put("usedRamBytes", JsonPrimitive(usedRamBytes))
                put("thresholdBytes", JsonPrimitive(memoryInfo.threshold.coerceAtLeast(0L)))
                put("lowMemory", JsonPrimitive(memoryInfo.lowMemory))
            })
            put("battery", buildJsonObject {
                put("state", JsonPrimitive(mapBatteryState(battery.status)))
                put("chargingType", JsonPrimitive(mapChargingType(battery.plugged)))
                battery.temperatureC?.let { put("temperatureC", JsonPrimitive(it)) }
                currentNowMa?.let { put("currentMa", JsonPrimitive(it)) }
            })
            put("power", buildJsonObject {
                put("dozeModeEnabled", JsonPrimitive(powerManager?.isDeviceIdleMode == true))
                put("lowPowerModeEnabled", JsonPrimitive(powerManager?.isPowerSaveMode == true))
            })
            put("system", buildJsonObject {
                Build.VERSION.SECURITY_PATCH?.trim()?.takeIf { it.isNotEmpty() }
                    ?.let { put("securityPatchLevel", JsonPrimitive(it)) }
            })
        }.toString()
    }

    // ── CB-exclusive sub-command router ──────────────────

    fun handleCommand(subCommand: String, params: JsonObject): String? = when (subCommand) {
        "info" -> infoPayloadJson()
        "status" -> statusPayloadJson()
        "permissions" -> permissionsPayloadJson()
        "health" -> healthPayloadJson()
        "display" -> getDisplayInfo()
        "settings" -> getSystemSettings()
        "uptime" -> buildJsonObject {
            put("uptimeMs", JsonPrimitive(SystemClock.elapsedRealtime()))
            put("uptimeMinutes", JsonPrimitive(SystemClock.elapsedRealtime() / 60_000))
        }.toString()
        else -> null
    }

    // ── Display & Settings (CB-exclusive) ───────────────

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
        }.toString()
    }

    fun getSystemSettings(): String {
        val cr = appContext.contentResolver
        return buildJsonObject {
            put("airplaneMode", JsonPrimitive(Settings.Global.getInt(cr, Settings.Global.AIRPLANE_MODE_ON, 0) == 1))
            put("autoRotate", JsonPrimitive(Settings.System.getInt(cr, Settings.System.ACCELEROMETER_ROTATION, 0) == 1))
            put("screenBrightness", JsonPrimitive(Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS, 128)))
            put("deviceName", JsonPrimitive(Settings.Global.getString(cr, Settings.Global.DEVICE_NAME) ?: Build.MODEL))
        }.toString()
    }

    // ── Battery helpers ─────────────────────────────────

    private data class BatterySnapshot(val status: Int, val plugged: Int, val levelFraction: Double?, val temperatureC: Double?)

    private fun readBatterySnapshot(): BatterySnapshot {
        val intent = appContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN) ?: BatteryManager.BATTERY_STATUS_UNKNOWN
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val temperatureC = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
            ?.takeIf { it != Int.MIN_VALUE }?.toDouble()?.div(10.0)
        return BatterySnapshot(status = status, plugged = plugged, levelFraction = batteryLevelFraction(intent), temperatureC = temperatureC)
    }

    private fun batteryLevelFraction(intent: Intent?): Double? {
        val rawLevel = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val rawScale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        if (rawLevel < 0 || rawScale <= 0) return null
        return rawLevel.toDouble() / rawScale.toDouble()
    }

    private fun mapBatteryState(status: Int): String = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
        BatteryManager.BATTERY_STATUS_FULL -> "full"
        BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "unplugged"
        else -> "unknown"
    }

    private fun mapChargingType(plugged: Int): String = when (plugged) {
        BatteryManager.BATTERY_PLUGGED_AC -> "ac"
        BatteryManager.BATTERY_PLUGGED_USB -> "usb"
        BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
        BatteryManager.BATTERY_PLUGGED_DOCK -> "dock"
        else -> "none"
    }

    // ── System helpers ──────────────────────────────────

    private fun mapThermalState(powerManager: PowerManager?): String {
        val thermal = powerManager?.currentThermalStatus ?: return "nominal"
        return when (thermal) {
            PowerManager.THERMAL_STATUS_NONE, PowerManager.THERMAL_STATUS_LIGHT -> "nominal"
            PowerManager.THERMAL_STATUS_MODERATE -> "fair"
            PowerManager.THERMAL_STATUS_SEVERE -> "serious"
            PowerManager.THERMAL_STATUS_CRITICAL, PowerManager.THERMAL_STATUS_EMERGENCY, PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
            else -> "nominal"
        }
    }

    private fun mapNetworkStatus(caps: NetworkCapabilities?): String {
        if (caps == null) return "unsatisfied"
        return when {
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) -> "satisfied"
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> "requiresConnection"
            else -> "unsatisfied"
        }
    }

    private fun mapMemoryPressure(totalBytes: Long, availableBytes: Long, lowMemory: Boolean): String {
        if (totalBytes <= 0L) return if (lowMemory) "critical" else "unknown"
        if (lowMemory) return "critical"
        val freeRatio = availableBytes.toDouble() / totalBytes.toDouble()
        return when {
            freeRatio <= 0.05 -> "critical"
            freeRatio <= 0.15 -> "high"
            freeRatio <= 0.30 -> "moderate"
            else -> "normal"
        }
    }

    private fun permissionStateJson(granted: Boolean, promptableWhenDenied: Boolean) = buildJsonObject {
        put("status", JsonPrimitive(if (granted) "granted" else "denied"))
        put("promptable", JsonPrimitive(!granted && promptableWhenDenied))
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(appContext, permission) == PackageManager.PERMISSION_GRANTED

    private fun networkInterfacesJson(caps: NetworkCapabilities?) = buildJsonArray {
        if (caps == null) return@buildJsonArray
        var hasKnownTransport = false
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) { hasKnownTransport = true; add(JsonPrimitive("wifi")) }
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) { hasKnownTransport = true; add(JsonPrimitive("cellular")) }
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) { hasKnownTransport = true; add(JsonPrimitive("wired")) }
        if (!hasKnownTransport) add(JsonPrimitive("other"))
    }

    // ── CPU architecture info ───────────────────────────

    fun cpuArchitecture(): String = Build.SUPPORTED_ABIS?.firstOrNull()?.trim().orEmpty().ifEmpty { "unknown" }

    fun supportedAbis(): List<String> = Build.SUPPORTED_ABIS?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

    // ── Battery health (OC parity) ──────────────────────

    fun batteryHealthString(): String {
        val intent = appContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val health = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN) ?: BatteryManager.BATTERY_HEALTH_UNKNOWN
        return when (health) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
            BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "overVoltage"
            BatteryManager.BATTERY_HEALTH_COLD -> "cold"
            BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "failure"
            else -> "unknown"
        }
    }
}
