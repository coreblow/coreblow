package ai.coreblow.app.node.handlers

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class DeviceHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_DEVICE

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "get-info" -> getDeviceInfo()
            "get-battery" -> getBatteryInfo()
            "get-storage" -> getStorageInfo()
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun getDeviceInfo(): JsonElement = buildJsonObject {
        put("manufacturer", Build.MANUFACTURER)
        put("model", Build.MODEL)
        put("brand", Build.BRAND)
        put("osVersion", Build.VERSION.RELEASE)
        put("sdkVersion", Build.VERSION.SDK_INT)
        put("device", Build.DEVICE)
        put("product", Build.PRODUCT)
        put("hardware", Build.HARDWARE)
        put("displayId", Build.DISPLAY)
    }

    private fun getBatteryInfo(): JsonElement {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val percentage = if (scale > 0) (level * 100) / scale else -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL

        return buildJsonObject {
            put("level", percentage)
            put("isCharging", isCharging)
            put("status", batteryStatusLabel(status))
        }
    }

    private fun getStorageInfo(): JsonElement {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalBytes = stat.totalBytes
        val freeBytes = stat.availableBytes

        return buildJsonObject {
            put("totalBytes", totalBytes)
            put("freeBytes", freeBytes)
            put("usedBytes", totalBytes - freeBytes)
        }
    }

    private fun batteryStatusLabel(status: Int): String = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
        BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
        BatteryManager.BATTERY_STATUS_FULL -> "full"
        BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not-charging"
        else -> "unknown"
    }
}
