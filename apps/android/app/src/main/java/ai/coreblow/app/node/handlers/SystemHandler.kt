package ai.coreblow.app.node.handlers

import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.serialization.json.*

/**
 * Handles system-level gateway invoke commands.
 * Provides device info, memory diagnostics, thermal state,
 * battery info, app metadata, and runtime metrics.
 */
class SystemHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "SystemHandler"
    }

    /**
     * Get comprehensive device information.
     */
    fun getDeviceInfo(): String = buildJsonObject {
        put("manufacturer", Build.MANUFACTURER)
        put("model", Build.MODEL)
        put("brand", Build.BRAND)
        put("device", Build.DEVICE)
        put("product", Build.PRODUCT)
        put("board", Build.BOARD)
        put("hardware", Build.HARDWARE)
        put("sdkInt", Build.VERSION.SDK_INT)
        put("release", Build.VERSION.RELEASE)
        put("codename", Build.VERSION.CODENAME)
        put("buildId", Build.ID)
        put("fingerprint", Build.FINGERPRINT)
        put("isEmulator", isEmulator())
        put("supportedAbis", Build.SUPPORTED_ABIS.joinToString(","))
        put("display", Build.DISPLAY)
    }.toString()

    /**
     * Get memory diagnostics.
     */
    fun getMemoryInfo(): String {
        val rt = Runtime.getRuntime()
        val totalMb = rt.totalMemory() / (1024 * 1024)
        val freeMb = rt.freeMemory() / (1024 * 1024)
        val maxMb = rt.maxMemory() / (1024 * 1024)
        val usedMb = totalMb - freeMb

        val am = appContext.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val memInfo = android.app.ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)

        return buildJsonObject {
            put("heapUsedMb", usedMb)
            put("heapFreeMb", freeMb)
            put("heapTotalMb", totalMb)
            put("heapMaxMb", maxMb)
            put("heapUsagePercent", if (maxMb > 0) (usedMb * 100 / maxMb) else 0)
            put("systemTotalMb", memInfo.totalMem / (1024 * 1024))
            put("systemAvailMb", memInfo.availMem / (1024 * 1024))
            put("systemLowMemory", memInfo.lowMemory)
            put("systemThreshold", memInfo.threshold / (1024 * 1024))
        }.toString()
    }

    /**
     * Get thermal state (API 29+).
     */
    fun getThermalState(): String {
        val pm = appContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager

        return buildJsonObject {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val thermal = pm.currentThermalStatus
                put("status", thermalStatusLabel(thermal))
                put("statusCode", thermal)
            } else {
                put("status", "unknown")
                put("statusCode", -1)
            }
            put("isPowerSaveMode", pm.isPowerSaveMode)
            put("isInteractive", pm.isInteractive)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                put("locationPowerSaveMode", pm.locationPowerSaveMode)
            }
        }.toString()
    }

    /**
     * Get battery information.
     */
    fun getBatteryInfo(): String {
        val bm = appContext.getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager

        return buildJsonObject {
            put("level", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY))
            put("isCharging", bm.isCharging)
            put("currentNow", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CURRENT_NOW))
            put("currentAvg", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE))
            put("energyCounter", bm.getLongProperty(android.os.BatteryManager.BATTERY_PROPERTY_ENERGY_COUNTER))
            put("chargeCounter", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER))
            put("status", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_STATUS))
        }.toString()
    }

    /**
     * Get app metadata.
     */
    fun getAppInfo(): String {
        val pm = appContext.packageManager
        val pi = pm.getPackageInfo(appContext.packageName, 0)

        return buildJsonObject {
            put("packageName", appContext.packageName)
            put("versionName", pi.versionName ?: "unknown")
            put("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode else @Suppress("DEPRECATION") pi.versionCode.toLong())
            put("firstInstallTime", pi.firstInstallTime)
            put("lastUpdateTime", pi.lastUpdateTime)
            put("targetSdk", appContext.applicationInfo.targetSdkVersion)
            put("minSdk", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) appContext.applicationInfo.minSdkVersion else 0)
            put("dataDir", appContext.applicationInfo.dataDir)
            put("cacheDir", appContext.cacheDir.absolutePath)
            put("filesDir", appContext.filesDir.absolutePath)
        }.toString()
    }

    /**
     * Get runtime metrics.
     */
    fun getRuntimeMetrics(): String {
        val rt = Runtime.getRuntime()
        return buildJsonObject {
            put("availableProcessors", rt.availableProcessors())
            put("activeThreads", Thread.activeCount())
            put("uptimeMs", android.os.SystemClock.elapsedRealtime())
            put("currentTimeMs", System.currentTimeMillis())
            put("timezone", java.util.TimeZone.getDefault().id)
            put("locale", java.util.Locale.getDefault().toLanguageTag())
            put("isRooted", isRooted())
        }.toString()
    }

    /**
     * Get storage information.
     */
    fun getStorageInfo(): String {
        val stat = android.os.StatFs(android.os.Environment.getDataDirectory().absolutePath)
        val totalGb = stat.totalBytes / (1024.0 * 1024 * 1024)
        val availGb = stat.availableBytes / (1024.0 * 1024 * 1024)

        return buildJsonObject {
            put("totalGb", "%.2f".format(totalGb).toDouble())
            put("availableGb", "%.2f".format(availGb).toDouble())
            put("usedPercent", ((stat.totalBytes - stat.availableBytes) * 100 / stat.totalBytes).toInt())
            put("internalCacheMb", (appContext.cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() } / (1024 * 1024)))
        }.toString()
    }

    /**
     * Get display information.
     */
    fun getDisplayInfo(): String {
        val dm = appContext.resources.displayMetrics
        val config = appContext.resources.configuration

        return buildJsonObject {
            put("widthPx", dm.widthPixels)
            put("heightPx", dm.heightPixels)
            put("density", dm.density)
            put("densityDpi", dm.densityDpi)
            put("xdpi", dm.xdpi)
            put("ydpi", dm.ydpi)
            put("screenWidthDp", config.screenWidthDp)
            put("screenHeightDp", config.screenHeightDp)
            put("smallestWidthDp", config.smallestScreenWidthDp)
            put("isTablet", config.smallestScreenWidthDp >= 600)
            put("fontScale", config.fontScale)
        }.toString()
    }

    // MARK: - Detection helpers

    private fun isEmulator(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
            Build.FINGERPRINT.startsWith("unknown") ||
            Build.MODEL.contains("sdk_gphone") ||
            Build.MODEL.contains("Emulator") ||
            Build.MODEL.contains("Android SDK") ||
            Build.MANUFACTURER.contains("Genymotion") ||
            Build.HARDWARE.contains("goldfish") ||
            Build.HARDWARE.contains("ranchu") ||
            Build.PRODUCT.contains("sdk") ||
            Build.PRODUCT.contains("vbox")
    }

    private fun isRooted(): Boolean {
        val paths = arrayOf("/system/app/Superuser.apk", "/system/xbin/su", "/sbin/su", "/system/bin/su")
        return paths.any { java.io.File(it).exists() }
    }

    private fun thermalStatusLabel(status: Int): String = when (status) {
        0 -> "none"
        1 -> "light"
        2 -> "moderate"
        3 -> "severe"
        4 -> "critical"
        5 -> "emergency"
        6 -> "shutdown"
        else -> "unknown"
    }
}
