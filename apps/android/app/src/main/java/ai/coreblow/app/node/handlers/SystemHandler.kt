package ai.coreblow.app.node.handlers

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Handles system-level operations for gateway invoke commands.
 * Provides device metadata, system clock info, screen state,
 * and runtime diagnostics.
 */
class SystemHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "SystemHandler"
    }

    fun getSystemInfo(): String = buildJsonObject {
        put("uptimeMs", JsonPrimitive(SystemClock.elapsedRealtime()))
        put("currentTimeMs", JsonPrimitive(System.currentTimeMillis()))
        put("bootTimeMs", JsonPrimitive(System.currentTimeMillis() - SystemClock.elapsedRealtime()))
        put("availableProcessors", JsonPrimitive(Runtime.getRuntime().availableProcessors()))
        put("maxMemoryMb", JsonPrimitive(Runtime.getRuntime().maxMemory() / (1024 * 1024)))
        put("totalMemoryMb", JsonPrimitive(Runtime.getRuntime().totalMemory() / (1024 * 1024)))
        put("freeMemoryMb", JsonPrimitive(Runtime.getRuntime().freeMemory() / (1024 * 1024)))
        put("javaVersion", JsonPrimitive(System.getProperty("java.vm.version") ?: ""))
        put("osVersion", JsonPrimitive("Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"))
        put("deviceName", JsonPrimitive(getDeviceName()))
        put("isEmulator", JsonPrimitive(isEmulator()))
    }.toString()

    fun getRuntimeStats(): String = buildJsonObject {
        val rt = Runtime.getRuntime()
        val usedMem = rt.totalMemory() - rt.freeMemory()
        put("heapUsedMb", JsonPrimitive(usedMem / (1024 * 1024)))
        put("heapTotalMb", JsonPrimitive(rt.totalMemory() / (1024 * 1024)))
        put("heapMaxMb", JsonPrimitive(rt.maxMemory() / (1024 * 1024)))
        put("heapUsedPercent", JsonPrimitive((usedMem * 100) / rt.maxMemory()))
        put("threadCount", JsonPrimitive(Thread.activeCount()))
        put("uptimeSeconds", JsonPrimitive(SystemClock.elapsedRealtime() / 1000))
    }.toString()

    fun getScreenState(): String {
        val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        return buildJsonObject {
            put("isInteractive", JsonPrimitive(powerManager.isInteractive))
            put("isPowerSaveMode", JsonPrimitive(powerManager.isPowerSaveMode))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                put("thermalStatus", JsonPrimitive(powerManager.currentThermalStatus))
            }
        }.toString()
    }

    private fun getDeviceName(): String {
        return try {
            Settings.Global.getString(appContext.contentResolver, Settings.Global.DEVICE_NAME) ?: Build.MODEL
        } catch (_: Throwable) { Build.MODEL }
    }

    private fun isEmulator(): Boolean {
        return Build.FINGERPRINT.contains("generic") ||
            Build.MODEL.contains("Emulator") ||
            Build.MODEL.contains("Android SDK") ||
            Build.MANUFACTURER.contains("Genymotion") ||
            Build.PRODUCT.contains("sdk") ||
            Build.HARDWARE.contains("goldfish") ||
            Build.HARDWARE.contains("ranchu")
    }
}
