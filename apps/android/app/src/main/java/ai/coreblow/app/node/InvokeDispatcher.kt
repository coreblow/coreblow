package ai.coreblow.app.node

import android.content.Context
import android.util.Log
import ai.coreblow.app.node.handlers.*
import ai.coreblow.app.voice.MicCaptureManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Central invoke dispatcher that routes gateway commands to the
 * appropriate handler. Maps command names to handler methods and
 * serializes results back to JSON for the gateway session.
 */
class InvokeDispatcher(
    private val appContext: Context,
    private val scope: CoroutineScope,
    private val cameraHandler: CameraHandler?,
    private val locationHandler: LocationHandler?,
    private val contactsHandler: ContactsHandler?,
    private val calendarHandler: CalendarHandler?,
    private val photosHandler: PhotosHandler?,
    private val deviceHandler: DeviceHandler?,
    private val motionHandler: MotionHandler?,
    private val smsManager: SmsManager?,
    private val a2uiHandler: A2UIHandler?,
    private val canvasController: CanvasController?,
    private val micCaptureManager: MicCaptureManager?,
) {
    companion object {
        private const val TAG = "InvokeDispatcher"
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val registeredCommands = mutableMapOf<String, suspend (JsonObject) -> String>()

    init {
        registerBuiltinCommands()
    }

    /**
     * All command names this dispatcher can handle.
     */
    fun supportedCommands(): List<String> = registeredCommands.keys.toList()

    /**
     * Register a custom command handler.
     */
    fun registerCommand(name: String, handler: suspend (JsonObject) -> String) {
        registeredCommands[name] = handler
    }

    /**
     * Dispatch an invoke request. Returns the JSON result string.
     * Throws on unknown command or handler error.
     */
    suspend fun dispatch(command: String, paramsJson: String): String {
        val params = try {
            json.parseToJsonElement(paramsJson).jsonObject
        } catch (_: Throwable) {
            JsonObject(emptyMap())
        }

        val handler = registeredCommands[command]
        if (handler != null) {
            return try {
                handler(params)
            } catch (e: Throwable) {
                Log.e(TAG, "Command '$command' failed: ${e.message}")
                errorResult("INVOKE_FAILED", e.message ?: "Unknown error")
            }
        }

        // Prefix-based routing for namespaced commands
        val result = dispatchNamespaced(command, params)
        if (result != null) return result

        Log.w(TAG, "Unknown command: $command")
        return errorResult("UNKNOWN_COMMAND", "Command not recognized: $command")
    }

    // MARK: - Registration

    private fun registerBuiltinCommands() {
        // Device
        registeredCommands["device.info"] = { deviceHandler?.getDeviceInfo() ?: emptyResult() }
        registeredCommands["device.battery"] = { deviceHandler?.getBatteryInfo() ?: emptyResult() }
        registeredCommands["device.network"] = { deviceHandler?.getNetworkInfo() ?: emptyResult() }
        registeredCommands["device.storage"] = { deviceHandler?.getStorageInfo() ?: emptyResult() }
        registeredCommands["device.display"] = { deviceHandler?.getDisplayInfo() ?: emptyResult() }
        registeredCommands["device.settings"] = { deviceHandler?.getSystemSettings() ?: emptyResult() }

        // Camera
        registeredCommands["camera.capture"] = { params ->
            val facing = (params["facing"] as? JsonPrimitive)?.content
            val quality = (params["quality"] as? JsonPrimitive)?.content?.toIntOrNull()
            val flash = (params["flash"] as? JsonPrimitive)?.content?.toBoolean() != false
            val result = cameraHandler?.capturePhoto(facing, quality, flash)
                ?: CaptureResult(success = false, error = "Camera not available")
            buildJsonObject {
                put("success", JsonPrimitive(result.success))
                result.base64?.let { put("base64", JsonPrimitive(it)) }
                result.thumbnailBase64?.let { put("thumbnail", JsonPrimitive(it)) }
                result.width?.let { put("width", JsonPrimitive(it)) }
                result.height?.let { put("height", JsonPrimitive(it)) }
                result.mimeType?.let { put("mimeType", JsonPrimitive(it)) }
                result.error?.let { put("error", JsonPrimitive(it)) }
            }.toString()
        }
        registeredCommands["camera.info"] = { cameraHandler?.getCameraInfo() ?: "[]" }

        // Location
        registeredCommands["location.current"] = { params ->
            val highAccuracy = (params["highAccuracy"] as? JsonPrimitive)?.content?.toBoolean() != false
            val geocode = (params["geocode"] as? JsonPrimitive)?.content?.toBoolean() == true
            val result = locationHandler?.getCurrentLocation(highAccuracy, geocode)
                ?: LocationResult(success = false, error = "Location not available")
            result.toJson()
        }
        registeredCommands["location.enabled"] = {
            buildJsonObject { put("enabled", JsonPrimitive(locationHandler?.isLocationEnabled() ?: false)) }.toString()
        }
        registeredCommands["location.providers"] = { locationHandler?.getProviderStatus() ?: "{}" }
        registeredCommands["location.geocode"] = { params ->
            val lat = (params["latitude"] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: 0.0
            val lng = (params["longitude"] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: 0.0
            locationHandler?.reverseGeocode(lat, lng) ?: "{}"
        }

        // Contacts
        registeredCommands["contacts.list"] = { params ->
            val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 100
            val offset = (params["offset"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0
            val search = (params["search"] as? JsonPrimitive)?.content
            contactsHandler?.listContacts(limit, offset, search) ?: "[]"
        }
        registeredCommands["contacts.get"] = { params ->
            val id = (params["id"] as? JsonPrimitive)?.content ?: ""
            contactsHandler?.getContact(id) ?: "{}"
        }

        // Calendar
        registeredCommands["calendar.events"] = { params ->
            val startMs = (params["startMs"] as? JsonPrimitive)?.content?.toLongOrNull()
            val endMs = (params["endMs"] as? JsonPrimitive)?.content?.toLongOrNull()
            val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 50
            calendarHandler?.getEvents(startMs, endMs, limit) ?: "[]"
        }
        registeredCommands["calendar.calendars"] = { calendarHandler?.getCalendars() ?: "[]" }

        // Photos
        registeredCommands["photos.recent"] = { params ->
            val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 20
            photosHandler?.getRecentPhotos(limit) ?: "[]"
        }

        // SMS
        registeredCommands["sms.read"] = { params ->
            val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 20
            val address = (params["address"] as? JsonPrimitive)?.content
            smsManager?.readMessages(limit, address) ?: "[]"
        }
        registeredCommands["sms.send"] = { params ->
            val to = (params["to"] as? JsonPrimitive)?.content ?: ""
            val body = (params["body"] as? JsonPrimitive)?.content ?: ""
            val result = smsManager?.sendMessage(to, body) ?: false
            buildJsonObject { put("success", JsonPrimitive(result)) }.toString()
        }

        // Motion
        registeredCommands["motion.sensors"] = {
            val sensors = motionHandler?.listAvailableSensors() ?: emptyList()
            buildJsonObject {
                put("sensors", JsonPrimitive(sensors.joinToString(",")))
            }.toString()
        }
        registeredCommands["motion.read"] = { params ->
            val sensor = (params["sensor"] as? JsonPrimitive)?.content ?: "accelerometer"
            val result = when (sensor) {
                "accelerometer" -> motionHandler?.readAccelerometer()
                "gyroscope" -> motionHandler?.readGyroscope()
                "stepCounter" -> motionHandler?.readStepCount()
                "gravity" -> motionHandler?.readGravity()
                "magneticField" -> motionHandler?.readMagneticField()
                "barometer" -> motionHandler?.readPressure()
                "light" -> motionHandler?.readLight()
                "proximity" -> motionHandler?.readProximity()
                else -> null
            }
            result?.toString() ?: buildJsonObject { put("error", JsonPrimitive("Sensor not available: $sensor")) }.toString()
        }
        registeredCommands["motion.all"] = {
            motionHandler?.readAllAvailable()?.toString() ?: "{}"
        }

        // Canvas / A2UI
        registeredCommands["canvas.render"] = { params ->
            canvasController?.render(params.toString()) ?: emptyResult()
        }
        registeredCommands["a2ui.action"] = { params ->
            a2uiHandler?.handleAction(params.toString()) ?: emptyResult()
        }

        // Mic
        registeredCommands["mic.start"] = {
            val started = micCaptureManager?.startCapture() ?: false
            buildJsonObject { put("success", JsonPrimitive(started)) }.toString()
        }
        registeredCommands["mic.stop"] = {
            micCaptureManager?.stopCapture()
            buildJsonObject { put("success", JsonPrimitive(true)) }.toString()
        }

        // Ping
        registeredCommands["ping"] = {
            buildJsonObject {
                put("pong", JsonPrimitive(true))
                put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
            }.toString()
        }
    }

    // MARK: - Namespaced Dispatch

    private suspend fun dispatchNamespaced(command: String, params: JsonObject): String? {
        val parts = command.split(".", limit = 2)
        if (parts.size < 2) return null

        return when (parts[0]) {
            "device" -> deviceHandler?.handleCommand(parts[1], params)
            "camera" -> null // already registered
            "location" -> null
            "contacts" -> contactsHandler?.handleCommand(parts[1], params)
            "calendar" -> calendarHandler?.handleCommand(parts[1], params)
            "photos" -> photosHandler?.handleCommand(parts[1], params)
            "sms" -> null
            "motion" -> null
            "canvas" -> canvasController?.handleCommand(parts[1], params)
            "a2ui" -> a2uiHandler?.handleCommand(parts[1], params)
            else -> null
        }
    }

    // MARK: - Helpers

    private fun emptyResult(): String = "{}"

    private fun errorResult(code: String, message: String): String {
        return buildJsonObject {
            put("error", buildJsonObject {
                put("code", JsonPrimitive(code))
                put("message", JsonPrimitive(message))
            })
        }.toString()
    }
}
