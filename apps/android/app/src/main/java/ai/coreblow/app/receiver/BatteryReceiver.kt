package ai.coreblow.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Receives battery state change broadcasts and exposes
 * reactive battery status for UI and gateway reporting.
 * Monitors charging, level, temperature, and health.
 */
class BatteryReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BatteryReceiver"

        private val _batteryState = MutableStateFlow(BatteryState())
        val batteryState: StateFlow<BatteryState> = _batteryState.asStateFlow()

        /**
         * Register receiver for battery change events.
         */
        fun register(context: Context): Intent? {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_BATTERY_CHANGED)
                addAction(Intent.ACTION_BATTERY_LOW)
                addAction(Intent.ACTION_BATTERY_OKAY)
                addAction(Intent.ACTION_POWER_CONNECTED)
                addAction(Intent.ACTION_POWER_DISCONNECTED)
            }
            return context.registerReceiver(BatteryReceiver(), filter)
        }

        /**
         * Get current battery state without registering.
         */
        fun getCurrentState(context: Context): BatteryState {
            val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            return intent?.let { parseIntent(it) } ?: BatteryState()
        }

        private fun parseIntent(intent: Intent): BatteryState {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
            val health = intent.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN)
            val voltage = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)
            val temperature = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
            val technology = intent.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY) ?: ""

            val percent = if (level >= 0 && scale > 0) (level * 100) / scale else -1

            return BatteryState(
                level = percent,
                isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL,
                isFull = status == BatteryManager.BATTERY_STATUS_FULL,
                plugType = when (plugged) {
                    BatteryManager.BATTERY_PLUGGED_AC -> PlugType.AC
                    BatteryManager.BATTERY_PLUGGED_USB -> PlugType.USB
                    BatteryManager.BATTERY_PLUGGED_WIRELESS -> PlugType.WIRELESS
                    else -> PlugType.NONE
                },
                health = when (health) {
                    BatteryManager.BATTERY_HEALTH_GOOD -> BatteryHealth.GOOD
                    BatteryManager.BATTERY_HEALTH_OVERHEAT -> BatteryHealth.OVERHEAT
                    BatteryManager.BATTERY_HEALTH_DEAD -> BatteryHealth.DEAD
                    BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> BatteryHealth.OVER_VOLTAGE
                    BatteryManager.BATTERY_HEALTH_COLD -> BatteryHealth.COLD
                    else -> BatteryHealth.UNKNOWN
                },
                voltageMv = voltage,
                temperatureTenths = temperature,
                technology = technology,
                updatedAt = System.currentTimeMillis(),
            )
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BATTERY_CHANGED -> {
                val state = parseIntent(intent)
                _batteryState.value = state
                Log.d(TAG, "Battery: ${state.level}% charging=${state.isCharging} temp=${state.temperatureCelsius}°C")
            }
            Intent.ACTION_BATTERY_LOW -> {
                val current = _batteryState.value
                _batteryState.value = current.copy(isLow = true)
                Log.w(TAG, "Battery LOW (${current.level}%)")
            }
            Intent.ACTION_BATTERY_OKAY -> {
                val current = _batteryState.value
                _batteryState.value = current.copy(isLow = false)
                Log.i(TAG, "Battery OK (${current.level}%)")
            }
            Intent.ACTION_POWER_CONNECTED -> {
                Log.i(TAG, "Power connected")
                _batteryState.value = _batteryState.value.copy(isCharging = true)
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                Log.i(TAG, "Power disconnected")
                _batteryState.value = _batteryState.value.copy(isCharging = false, plugType = PlugType.NONE)
            }
        }
    }
}

data class BatteryState(
    val level: Int = -1,
    val isCharging: Boolean = false,
    val isFull: Boolean = false,
    val isLow: Boolean = false,
    val plugType: PlugType = PlugType.NONE,
    val health: BatteryHealth = BatteryHealth.UNKNOWN,
    val voltageMv: Int = 0,
    val temperatureTenths: Int = 0,
    val technology: String = "",
    val updatedAt: Long = 0,
) {
    val temperatureCelsius: Float get() = temperatureTenths / 10f
    val voltageV: Float get() = voltageMv / 1000f
    val isOverheating: Boolean get() = temperatureCelsius > 42f
    val isCritical: Boolean get() = level in 1..5 && !isCharging
    val levelLabel: String get() = when {
        level < 0 -> "Unknown"
        isFull -> "Full"
        isCharging -> "Charging ($level%)"
        isLow -> "Low ($level%)"
        else -> "$level%"
    }
    val statusIcon: String get() = when {
        isFull -> "🔋"
        isCharging -> "⚡"
        level <= 15 -> "🪫"
        else -> "🔋"
    }
    val healthLabel: String get() = health.label
}

enum class PlugType { NONE, AC, USB, WIRELESS }

enum class BatteryHealth(val label: String) {
    UNKNOWN("Unknown"),
    GOOD("Good"),
    OVERHEAT("Overheating"),
    DEAD("Dead"),
    OVER_VOLTAGE("Over Voltage"),
    COLD("Cold"),
}
