package ai.coreblow.app.node.handlers

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class MotionHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_MOTION

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "get-steps" -> getStepCount()
            "get-activity" -> getMotionActivity()
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun getStepCount(): JsonElement {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val hasStepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
        return buildJsonObject {
            put("available", hasStepCounter)
            put("message", if (hasStepCounter) "Step counter available" else "No step counter sensor")
        }
    }

    private fun getMotionActivity(): JsonElement {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val hasAccelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
        return buildJsonObject {
            put("accelerometer", hasAccelerometer)
        }
    }
}
