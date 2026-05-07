package ai.coreblow.app.node.handlers

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlin.coroutines.resume

/**
 * Handles device motion data: accelerometer, gyroscope, step counter,
 * gravity, magnetic field, barometer, light, and proximity sensors.
 */
class MotionHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "CoreBlowMotion"
        private const val SAMPLE_TIMEOUT_MS = 3000L
    }

    private val sensorManager: SensorManager by lazy {
        appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    fun isActivityAvailable(): Boolean {
        return sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null ||
            sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null
    }

    fun isPedometerAvailable(): Boolean {
        return sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    fun isAccelerometerAvailable(): Boolean =
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null

    fun isGyroscopeAvailable(): Boolean =
        sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null

    suspend fun readAccelerometer(): JsonObject? = readXYZSensor(Sensor.TYPE_ACCELEROMETER, "accelerometer")
    suspend fun readGyroscope(): JsonObject? = readXYZSensor(Sensor.TYPE_GYROSCOPE, "gyroscope")
    suspend fun readGravity(): JsonObject? = readXYZSensor(Sensor.TYPE_GRAVITY, "gravity")
    suspend fun readMagneticField(): JsonObject? = readXYZSensor(Sensor.TYPE_MAGNETIC_FIELD, "magneticField")

    suspend fun readStepCount(): JsonObject? = withContext(Dispatchers.Main) {
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return@withContext null
        readSingleSample(sensor)?.let { values ->
            buildJsonObject {
                put("steps", JsonPrimitive(values.getOrNull(0)?.toLong() ?: 0L))
                put("sensor", JsonPrimitive("stepCounter"))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }
        }
    }

    suspend fun readPressure(): JsonObject? = withContext(Dispatchers.Main) {
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE) ?: return@withContext null
        readSingleSample(sensor)?.let { values ->
            buildJsonObject {
                put("pressure", JsonPrimitive(values.getOrNull(0)?.toDouble() ?: 0.0))
                put("unit", JsonPrimitive("hPa"))
                put("sensor", JsonPrimitive("barometer"))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }
        }
    }

    suspend fun readLight(): JsonObject? = withContext(Dispatchers.Main) {
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT) ?: return@withContext null
        readSingleSample(sensor)?.let { values ->
            buildJsonObject {
                put("lux", JsonPrimitive(values.getOrNull(0)?.toDouble() ?: 0.0))
                put("sensor", JsonPrimitive("light"))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }
        }
    }

    suspend fun readProximity(): JsonObject? = withContext(Dispatchers.Main) {
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY) ?: return@withContext null
        readSingleSample(sensor)?.let { values ->
            val maxRange = sensor.maximumRange
            val distance = values.getOrNull(0) ?: maxRange
            buildJsonObject {
                put("distance", JsonPrimitive(distance.toDouble()))
                put("maxRange", JsonPrimitive(maxRange.toDouble()))
                put("isNear", JsonPrimitive(distance < maxRange))
                put("sensor", JsonPrimitive("proximity"))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }
        }
    }

    fun listAvailableSensors(): List<String> {
        val available = mutableListOf<String>()
        if (isAccelerometerAvailable()) available.add("accelerometer")
        if (isGyroscopeAvailable()) available.add("gyroscope")
        if (isPedometerAvailable()) available.add("stepCounter")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY) != null) available.add("gravity")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null) available.add("magneticField")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE) != null) available.add("barometer")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT) != null) available.add("light")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY) != null) available.add("proximity")
        return available
    }

    suspend fun readAllAvailable(): JsonObject = buildJsonObject {
        readAccelerometer()?.let { put("accelerometer", it) }
        readGyroscope()?.let { put("gyroscope", it) }
        readStepCount()?.let { put("stepCounter", it) }
        readGravity()?.let { put("gravity", it) }
        readMagneticField()?.let { put("magneticField", it) }
        readPressure()?.let { put("barometer", it) }
        readLight()?.let { put("light", it) }
        readProximity()?.let { put("proximity", it) }
    }

    // MARK: - Private

    private suspend fun readXYZSensor(type: Int, name: String): JsonObject? = withContext(Dispatchers.Main) {
        val sensor = sensorManager.getDefaultSensor(type) ?: return@withContext null
        readSingleSample(sensor)?.let { values ->
            buildJsonObject {
                put("x", JsonPrimitive(values.getOrNull(0)?.toDouble() ?: 0.0))
                put("y", JsonPrimitive(values.getOrNull(1)?.toDouble() ?: 0.0))
                put("z", JsonPrimitive(values.getOrNull(2)?.toDouble() ?: 0.0))
                put("sensor", JsonPrimitive(name))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }
        }
    }

    private suspend fun readSingleSample(sensor: Sensor): FloatArray? {
        return withTimeoutOrNull(SAMPLE_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent) {
                        sensorManager.unregisterListener(this)
                        cont.resume(event.values.copyOf())
                    }
                    override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
                }
                val registered = sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                if (!registered) {
                    Log.w(TAG, "Failed to register sensor: ${sensor.name}")
                    cont.resume(null)
                }
                cont.invokeOnCancellation { sensorManager.unregisterListener(listener) }
            }
        }
    }
}
