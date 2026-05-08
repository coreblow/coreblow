package ai.coreblow.app.node.handlers

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import ai.coreblow.app.gateway.GatewaySession
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.InternalCoroutinesApi
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.coroutines.resume
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Handles device motion data: accelerometer classification,
 * pedometer queries, and raw sensor reads.
 *
 * Uses [MotionDataSource] for testability of gateway commands.
 */

private const val ACCELEROMETER_SAMPLE_TARGET = 20
private const val ACCELEROMETER_SAMPLE_TIMEOUT_MS = 6_000L
private const val SINGLE_SAMPLE_TIMEOUT_MS = 3_000L

// ── Data models ─────────────────────────────────────────

data class MotionActivityRequest(val startISO: String?, val endISO: String?, val limit: Int)
data class MotionPedometerRequest(val startISO: String?, val endISO: String?)

data class MotionActivityRecord(
    val startISO: String,
    val endISO: String,
    val confidence: String,
    val isWalking: Boolean,
    val isRunning: Boolean,
    val isCycling: Boolean,
    val isAutomotive: Boolean,
    val isStationary: Boolean,
    val isUnknown: Boolean,
)

data class PedometerRecord(
    val startISO: String,
    val endISO: String,
    val steps: Int?,
    val distanceMeters: Double?,
    val floorsAscended: Int?,
    val floorsDescended: Int?,
)

// ── Data source interface ───────────────────────────────

interface MotionDataSource {
    fun isActivityAvailable(context: Context): Boolean
    fun isPedometerAvailable(context: Context): Boolean
    fun isAvailable(context: Context): Boolean = isActivityAvailable(context) || isPedometerAvailable(context)
    fun hasPermission(context: Context): Boolean
    suspend fun activity(context: Context, request: MotionActivityRequest): MotionActivityRecord
    suspend fun pedometer(context: Context, request: MotionPedometerRequest): PedometerRecord
}

// ── System data source ──────────────────────────────────

private object SystemMotionDataSource : MotionDataSource {
    override fun isActivityAvailable(context: Context): Boolean {
        val sm = context.getSystemService(SensorManager::class.java)
        return sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
    }

    override fun isPedometerAvailable(context: Context): Boolean {
        val sm = context.getSystemService(SensorManager::class.java)
        return sm?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    override fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    override suspend fun activity(context: Context, request: MotionActivityRequest): MotionActivityRecord {
        if (!request.startISO.isNullOrBlank() || !request.endISO.isNullOrBlank()) {
            throw IllegalArgumentException("MOTION_RANGE_UNAVAILABLE: historical activity range not supported on Android")
        }
        val sm = context.getSystemService(SensorManager::class.java)
            ?: throw IllegalStateException("MOTION_UNAVAILABLE: sensor manager unavailable")
        val accelerometer = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            ?: throw IllegalStateException("MOTION_UNAVAILABLE: accelerometer not available")

        val sample = readAccelerometerSample(sm, accelerometer)
            ?: throw IllegalStateException("MOTION_UNAVAILABLE: no accelerometer sample")
        val end = Instant.now()
        val start = end.minusSeconds(2)
        val classification = classifyActivity(sample.averageDelta)
        return MotionActivityRecord(
            startISO = start.toString(), endISO = end.toString(),
            confidence = classifyConfidence(sample.samples, sample.averageDelta),
            isWalking = classification == "walking", isRunning = classification == "running",
            isCycling = false, isAutomotive = false,
            isStationary = classification == "stationary", isUnknown = classification == "unknown",
        )
    }

    override suspend fun pedometer(context: Context, request: MotionPedometerRequest): PedometerRecord {
        if (!request.startISO.isNullOrBlank() || !request.endISO.isNullOrBlank()) {
            throw IllegalArgumentException("PEDOMETER_RANGE_UNAVAILABLE: historical pedometer range not supported on Android")
        }
        val sm = context.getSystemService(SensorManager::class.java)
            ?: throw IllegalStateException("PEDOMETER_UNAVAILABLE: sensor manager unavailable")
        val stepCounter = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            ?: throw IllegalStateException("PEDOMETER_UNAVAILABLE: step counting not supported")

        val steps = readStepCounter(sm, stepCounter)
            ?: throw IllegalStateException("PEDOMETER_UNAVAILABLE: no step counter sample")
        val bootMs = System.currentTimeMillis() - SystemClock.elapsedRealtime()
        return PedometerRecord(
            startISO = Instant.ofEpochMilli(max(0L, bootMs)).toString(),
            endISO = Instant.now().toString(),
            steps = steps, distanceMeters = null, floorsAscended = null, floorsDescended = null,
        )
    }

    // ── Accelerometer sampling ──────────────────────────

    private data class AccelerometerSample(val samples: Int, val averageDelta: Double)

    @OptIn(InternalCoroutinesApi::class)
    private suspend fun readAccelerometerSample(sm: SensorManager, sensor: Sensor): AccelerometerSample? {
        return withTimeoutOrNull(ACCELEROMETER_SAMPLE_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                var count = 0
                var sumDelta = 0.0
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent?) {
                        val values = event?.values ?: return
                        if (values.size < 3) return
                        val magnitude = sqrt(values[0] * values[0] + values[1] * values[1] + values[2] * values[2]).toDouble()
                        sumDelta += abs(magnitude - SensorManager.GRAVITY_EARTH.toDouble())
                        count += 1
                        if (count >= ACCELEROMETER_SAMPLE_TARGET) {
                            val result = AccelerometerSample(samples = count, averageDelta = sumDelta / count)
                            val token = cont.tryResume(result) ?: return
                            cont.completeResume(token)
                            sm.unregisterListener(this)
                        }
                    }
                    override fun onAccuracyChanged(s: Sensor?, accuracy: Int) = Unit
                }
                val registered = sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                if (!registered) { cont.resume(null) { _, _, _ -> }; return@suspendCancellableCoroutine }
                cont.invokeOnCancellation { sm.unregisterListener(listener) }
            }
        }
    }

    @OptIn(InternalCoroutinesApi::class)
    private suspend fun readStepCounter(sm: SensorManager, sensor: Sensor): Int? {
        val sample = withTimeoutOrNull(1200L) {
            suspendCancellableCoroutine<Float?> { cont ->
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent?) {
                        val value = event?.values?.firstOrNull()
                        val token = cont.tryResume(value) ?: return
                        cont.completeResume(token)
                        sm.unregisterListener(this)
                    }
                    override fun onAccuracyChanged(s: Sensor?, accuracy: Int) = Unit
                }
                val registered = sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                if (!registered) { sm.unregisterListener(listener); cont.resume(null) { _, _, _ -> }; return@suspendCancellableCoroutine }
                cont.invokeOnCancellation { sm.unregisterListener(listener) }
            }
        }
        return sample?.toInt()?.takeIf { it >= 0 }
    }

    private fun classifyActivity(averageDelta: Double): String = when {
        averageDelta <= 0.55 -> "stationary"
        averageDelta <= 1.80 -> "walking"
        else -> "running"
    }

    private fun classifyConfidence(samples: Int, averageDelta: Double): String {
        if (samples < 6) return "low"
        if (samples >= 14 && averageDelta > 0.4) return "high"
        return "medium"
    }
}

// ── Handler (gateway integration) ───────────────────────

class MotionHandler private constructor(
    private val appContext: Context,
    private val dataSource: MotionDataSource,
) {
    constructor(appContext: Context) : this(appContext = appContext, dataSource = SystemMotionDataSource)

    companion object {
        private const val TAG = "CoreBlowMotion"

        fun isMotionCapabilityAvailable(context: Context): Boolean = SystemMotionDataSource.isAvailable(context)

        fun forTesting(appContext: Context, dataSource: MotionDataSource): MotionHandler =
            MotionHandler(appContext = appContext, dataSource = dataSource)
    }

    fun isAvailable(): Boolean = dataSource.isAvailable(appContext)
    fun isActivityAvailable(): Boolean = dataSource.isActivityAvailable(appContext)
    fun isPedometerAvailable(): Boolean = dataSource.isPedometerAvailable(appContext)

    suspend fun handleMotionActivity(paramsJson: String?): GatewaySession.InvokeResult {
        if (!dataSource.hasPermission(appContext)) {
            return GatewaySession.InvokeResult.error(
                code = "MOTION_PERMISSION_REQUIRED",
                message = "MOTION_PERMISSION_REQUIRED: grant Motion permission",
            )
        }
        val request = parseActivityRequest(paramsJson)
            ?: return GatewaySession.InvokeResult.error(code = "INVALID_REQUEST", message = "INVALID_REQUEST: expected JSON object")

        return try {
            val activity = dataSource.activity(appContext, request)
            Log.d(TAG, "motion.activity classified: walking=${activity.isWalking}, running=${activity.isRunning}")
            GatewaySession.InvokeResult.ok(
                buildJsonObject {
                    put("activities", buildJsonArray {
                        add(buildJsonObject {
                            put("startISO", JsonPrimitive(activity.startISO))
                            put("endISO", JsonPrimitive(activity.endISO))
                            put("confidence", JsonPrimitive(activity.confidence))
                            put("isWalking", JsonPrimitive(activity.isWalking))
                            put("isRunning", JsonPrimitive(activity.isRunning))
                            put("isCycling", JsonPrimitive(activity.isCycling))
                            put("isAutomotive", JsonPrimitive(activity.isAutomotive))
                            put("isStationary", JsonPrimitive(activity.isStationary))
                            put("isUnknown", JsonPrimitive(activity.isUnknown))
                        })
                    })
                }.toString(),
            )
        } catch (err: IllegalArgumentException) {
            GatewaySession.InvokeResult.error(code = "MOTION_UNAVAILABLE", message = err.message ?: "MOTION_UNAVAILABLE")
        } catch (err: Throwable) {
            GatewaySession.InvokeResult.error(code = "MOTION_UNAVAILABLE", message = "MOTION_UNAVAILABLE: ${err.message ?: "motion activity failed"}")
        }
    }

    suspend fun handleMotionPedometer(paramsJson: String?): GatewaySession.InvokeResult {
        if (!dataSource.hasPermission(appContext)) {
            return GatewaySession.InvokeResult.error(
                code = "MOTION_PERMISSION_REQUIRED",
                message = "MOTION_PERMISSION_REQUIRED: grant Motion permission",
            )
        }
        val request = parsePedometerRequest(paramsJson)
            ?: return GatewaySession.InvokeResult.error(code = "INVALID_REQUEST", message = "INVALID_REQUEST: expected JSON object")

        return try {
            val payload = dataSource.pedometer(appContext, request)
            Log.d(TAG, "motion.pedometer steps=${payload.steps}")
            GatewaySession.InvokeResult.ok(
                buildJsonObject {
                    put("startISO", JsonPrimitive(payload.startISO))
                    put("endISO", JsonPrimitive(payload.endISO))
                    payload.steps?.let { put("steps", JsonPrimitive(it)) }
                    payload.distanceMeters?.let { put("distanceMeters", JsonPrimitive(it)) }
                    payload.floorsAscended?.let { put("floorsAscended", JsonPrimitive(it)) }
                    payload.floorsDescended?.let { put("floorsDescended", JsonPrimitive(it)) }
                }.toString(),
            )
        } catch (err: IllegalArgumentException) {
            GatewaySession.InvokeResult.error(code = "MOTION_UNAVAILABLE", message = err.message ?: "MOTION_UNAVAILABLE")
        } catch (err: Throwable) {
            GatewaySession.InvokeResult.error(code = "MOTION_UNAVAILABLE", message = "MOTION_UNAVAILABLE: ${err.message ?: "pedometer query failed"}")
        }
    }

    // ── Raw sensor reads (CB-exclusive) ─────────────────

    private val sensorManager: SensorManager by lazy {
        appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

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

    fun listAvailableSensors(): List<String> = buildList {
        if (sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null) add("accelerometer")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null) add("gyroscope")
        if (isPedometerAvailable()) add("stepCounter")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY) != null) add("gravity")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null) add("magneticField")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE) != null) add("barometer")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT) != null) add("light")
        if (sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY) != null) add("proximity")
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

    // ── Request parsing ─────────────────────────────────

    private fun parseActivityRequest(paramsJson: String?): MotionActivityRequest? {
        if (paramsJson.isNullOrBlank()) return MotionActivityRequest(startISO = null, endISO = null, limit = 200)
        val params = try { Json.parseToJsonElement(paramsJson) as? JsonObject } catch (_: Throwable) { null } ?: return null
        val limit = ((params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 200).coerceIn(1, 1000)
        return MotionActivityRequest(
            startISO = (params["startISO"] as? JsonPrimitive)?.content?.trim()?.ifEmpty { null },
            endISO = (params["endISO"] as? JsonPrimitive)?.content?.trim()?.ifEmpty { null },
            limit = limit,
        )
    }

    private fun parsePedometerRequest(paramsJson: String?): MotionPedometerRequest? {
        if (paramsJson.isNullOrBlank()) return MotionPedometerRequest(startISO = null, endISO = null)
        val params = try { Json.parseToJsonElement(paramsJson) as? JsonObject } catch (_: Throwable) { null } ?: return null
        return MotionPedometerRequest(
            startISO = (params["startISO"] as? JsonPrimitive)?.content?.trim()?.ifEmpty { null },
            endISO = (params["endISO"] as? JsonPrimitive)?.content?.trim()?.ifEmpty { null },
        )
    }

    // ── Private sensor helpers ──────────────────────────

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
        return withTimeoutOrNull(SINGLE_SAMPLE_TIMEOUT_MS) {
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
