package ai.coreblow.app.gateway

import kotlinx.serialization.json.*

/**
 * Protocol constants, message types, capabilities, scopes,
 * and error structures for gateway communication.
 * Centralizes all interaction primitives to prevent string-literal fragmentation.
 */
object CoreBlowProtocol {
    // Protocol version
    const val PROTOCOL_VERSION = "1.0.0" // pragma: allowlist secret

    // Connection types
    const val TRANSPORT_WEBSOCKET = "websocket"
    const val TRANSPORT_HTTP = "http"
    const val TRANSPORT_GRPC = "grpc"

    // Roles
    const val ROLE_NODE = "node"
    const val ROLE_CONTROLLER = "controller"
    const val ROLE_OBSERVER = "observer"

    // Auth modes
    const val AUTH_NONE = "none"
    const val AUTH_TOKEN = "token"
    const val AUTH_DEVICE_TOKEN = "device_token" // pragma: allowlist secret
    const val AUTH_CERTIFICATE = "certificate"

    // Message types
    const val MSG_HELLO = "hello"
    const val MSG_AUTH = "auth"
    const val MSG_AUTH_OK = "auth_ok"
    const val MSG_AUTH_FAIL = "auth_fail"
    const val MSG_INVOKE = "invoke"
    const val MSG_INVOKE_RESULT = "invoke_result"
    const val MSG_INVOKE_ERROR = "invoke_error"
    const val MSG_EVENT = "event"
    const val MSG_SUBSCRIBE = "subscribe"
    const val MSG_UNSUBSCRIBE = "unsubscribe"
    const val MSG_PING = "ping"
    const val MSG_PONG = "pong"
    const val MSG_CLOSE = "close"
    const val MSG_STREAM_START = "stream_start"
    const val MSG_STREAM_CHUNK = "stream_chunk"
    const val MSG_STREAM_END = "stream_end"
    const val MSG_STREAM_ERROR = "stream_error"
    const val MSG_CAPABILITY_QUERY = "capability_query"
    const val MSG_CAPABILITY_RESPONSE = "capability_response"

    // Namespaces
    const val NS_SYSTEM = "system"
    const val NS_CAMERA = "camera"
    const val NS_LOCATION = "location"
    const val NS_CONTACTS = "contacts"
    const val NS_CALENDAR = "calendar"
    const val NS_SMS = "sms"
    const val NS_PHOTOS = "photos"
    const val NS_CANVAS = "canvas"
    const val NS_A2UI = "a2ui"
    const val NS_VOICE = "voice"
    const val NS_DEVICE = "device"
    const val NS_NOTIFICATIONS = "notifications"
    const val NS_DEBUG = "debug"
    const val NS_STORAGE = "storage"
    const val NS_CLIPBOARD = "clipboard"
    const val NS_SENSORS = "sensors"

    // Capabilities
    const val CAP_CAMERA = "camera"
    const val CAP_LOCATION = "location"
    const val CAP_CONTACTS = "contacts"
    const val CAP_CALENDAR = "calendar"
    const val CAP_SMS = "sms"
    const val CAP_PHOTOS = "photos"
    const val CAP_CANVAS = "canvas"
    const val CAP_A2UI = "a2ui"
    const val CAP_VOICE = "voice"
    const val CAP_NOTIFICATIONS = "notifications"
    const val CAP_STORAGE = "storage"
    const val CAP_CLIPBOARD = "clipboard"
    const val CAP_SENSORS = "sensors"
    const val CAP_BIOMETRIC = "biometric"

    val ALL_CAPABILITIES = listOf(
        CAP_CAMERA, CAP_LOCATION, CAP_CONTACTS, CAP_CALENDAR,
        CAP_SMS, CAP_PHOTOS, CAP_CANVAS, CAP_A2UI, CAP_VOICE,
        CAP_NOTIFICATIONS, CAP_STORAGE, CAP_CLIPBOARD, CAP_SENSORS,
        CAP_BIOMETRIC,
    )

    // Scopes
    const val SCOPE_READ = "read"
    const val SCOPE_WRITE = "write"
    const val SCOPE_EXECUTE = "execute"
    const val SCOPE_ADMIN = "admin"

    val ALL_SCOPES = listOf(SCOPE_READ, SCOPE_WRITE, SCOPE_EXECUTE)

    // Error codes
    const val ERR_UNKNOWN = 1000
    const val ERR_AUTH_FAILED = 1001
    const val ERR_NOT_FOUND = 1002
    const val ERR_PERMISSION_DENIED = 1003
    const val ERR_INVALID_PARAMS = 1004
    const val ERR_TIMEOUT = 1005
    const val ERR_RATE_LIMIT = 1006
    const val ERR_INTERNAL = 1007
    const val ERR_NOT_SUPPORTED = 1008
    const val ERR_BUSY = 1009
    const val ERR_CANCELLED = 1010
    const val ERR_DISCONNECTED = 1011
    const val ERR_PAYLOAD_TOO_LARGE = 1012

    fun errorMessage(code: Int): String = when (code) {
        ERR_UNKNOWN -> "Unknown error"
        ERR_AUTH_FAILED -> "Authentication failed"
        ERR_NOT_FOUND -> "Resource not found"
        ERR_PERMISSION_DENIED -> "Permission denied"
        ERR_INVALID_PARAMS -> "Invalid parameters"
        ERR_TIMEOUT -> "Request timeout"
        ERR_RATE_LIMIT -> "Rate limit exceeded"
        ERR_INTERNAL -> "Internal error"
        ERR_NOT_SUPPORTED -> "Not supported"
        ERR_BUSY -> "Device busy"
        ERR_CANCELLED -> "Request cancelled"
        ERR_DISCONNECTED -> "Disconnected"
        ERR_PAYLOAD_TOO_LARGE -> "Payload too large"
        else -> "Error $code"
    }

    // Event types
    const val EVT_CONNECTED = "connected"
    const val EVT_DISCONNECTED = "disconnected"
    const val EVT_RECONNECTING = "reconnecting"
    const val EVT_MESSAGE = "message"
    const val EVT_STREAM = "stream"
    const val EVT_ERROR = "error"
    const val EVT_CAPABILITY_CHANGED = "capability_changed"
    const val EVT_BATTERY = "battery"
    const val EVT_CONNECTIVITY = "connectivity"
    const val EVT_SCREEN = "screen"
    const val EVT_LOCATION = "location"
    const val EVT_NOTIFICATION = "notification"

    // Message builders
    fun buildInvokeMessage(id: String, namespace: String, command: String, params: JsonObject = JsonObject(emptyMap())): String {
        return buildJsonObject {
            put("type", MSG_INVOKE)
            put("id", id)
            put("namespace", namespace)
            put("command", command)
            put("params", params)
            put("timestampMs", System.currentTimeMillis())
        }.toString()
    }

    fun buildResultMessage(id: String, result: JsonElement): String {
        return buildJsonObject {
            put("type", MSG_INVOKE_RESULT)
            put("id", id)
            put("result", result)
            put("timestampMs", System.currentTimeMillis())
        }.toString()
    }

    fun buildErrorMessage(id: String, code: Int, message: String? = null): String {
        return buildJsonObject {
            put("type", MSG_INVOKE_ERROR)
            put("id", id)
            put("error", buildJsonObject {
                put("code", code)
                put("message", message ?: errorMessage(code))
            })
            put("timestampMs", System.currentTimeMillis())
        }.toString()
    }

    fun buildEventMessage(event: String, data: JsonObject = JsonObject(emptyMap())): String {
        return buildJsonObject {
            put("type", MSG_EVENT)
            put("event", event)
            put("data", data)
            put("timestampMs", System.currentTimeMillis())
        }.toString()
    }

    fun buildPingMessage(): String = buildJsonObject {
        put("type", MSG_PING)
        put("timestampMs", System.currentTimeMillis())
    }.toString()

    fun buildPongMessage(): String = buildJsonObject {
        put("type", MSG_PONG)
        put("timestampMs", System.currentTimeMillis())
    }.toString()

    /**
     * Parse a raw gateway message into type + payload.
     */
    fun parseMessage(raw: String): Pair<String, JsonObject>? {
        return try {
            val json = Json.parseToJsonElement(raw).jsonObject
            val type = json["type"]?.jsonPrimitive?.content ?: return null
            Pair(type, json)
        } catch (_: Throwable) { null }
    }
}
