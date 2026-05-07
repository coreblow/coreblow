package ai.coreblow.app.gateway

/**
 * CoreBlow gateway protocol constants.
 * Defines all message types, auth modes, capabilities,
 * and protocol versioning for the WebSocket protocol.
 */
object CoreBlowProtocol {
    const val PROTOCOL_VERSION = "1.0"

    // Message types
    const val MSG_HELLO = "hello"
    const val MSG_AUTH_RESULT = "authResult"
    const val MSG_INVOKE = "invoke"
    const val MSG_RESULT = "result"
    const val MSG_ERROR = "error"
    const val MSG_EVENT = "event"
    const val MSG_PING = "ping"
    const val MSG_PONG = "pong"
    const val MSG_BYE = "bye"
    const val MSG_SUBSCRIBE = "subscribe"
    const val MSG_UNSUBSCRIBE = "unsubscribe"

    // Auth types
    const val AUTH_DEVICE_TOKEN = "deviceToken"
    const val AUTH_BOOTSTRAP = "bootstrap"
    const val AUTH_PASSWORD = "password" // pragma: allowlist secret
    const val AUTH_NONE = "none"

    // Roles
    const val ROLE_NODE = "node"
    const val ROLE_CLIENT = "client"
    const val ROLE_ADMIN = "admin"

    // Capabilities
    const val CAP_CAMERA = "camera"
    const val CAP_LOCATION = "location"
    const val CAP_MICROPHONE = "microphone"
    const val CAP_SMS = "sms"
    const val CAP_CONTACTS = "contacts"
    const val CAP_CALENDAR = "calendar"
    const val CAP_PHOTOS = "photos"
    const val CAP_MOTION = "motion"
    const val CAP_NOTIFICATIONS = "notifications"
    const val CAP_TTS = "tts"
    const val CAP_CANVAS = "canvas"
    const val CAP_A2UI = "a2ui"

    // Scopes
    const val SCOPE_CHAT = "chat"
    const val SCOPE_INVOKE = "invoke"
    const val SCOPE_CANVAS = "canvas"
    const val SCOPE_VOICE = "voice"
    const val SCOPE_EVENTS = "events"
    const val SCOPE_ADMIN = "admin"

    // Error codes
    const val ERR_UNKNOWN = "UNKNOWN"
    const val ERR_AUTH_FAILED = "AUTH_FAILED"
    const val ERR_INVOKE_FAILED = "INVOKE_FAILED"
    const val ERR_UNKNOWN_COMMAND = "UNKNOWN_COMMAND"
    const val ERR_TIMEOUT = "TIMEOUT"
    const val ERR_PERMISSION_DENIED = "PERMISSION_DENIED"
    const val ERR_RATE_LIMITED = "RATE_LIMITED"
    const val ERR_NOT_CONNECTED = "NOT_CONNECTED"
    const val ERR_INVALID_PARAMS = "INVALID_PARAMS"

    // Event types
    const val EVT_CHAT = "chat"
    const val EVT_NOTIFICATION = "notification"
    const val EVT_VOICE_TRANSCRIPT = "voice.transcript"
    const val EVT_VOICE_DIRECTIVE = "voice.directive"
    const val EVT_VOICE_CANCEL = "voice.cancel"
    const val EVT_TTS_AUDIO = "tts.audio"
    const val EVT_CANVAS_MESSAGE = "canvas.message"
    const val EVT_STATUS = "status"
    const val EVT_SEQ_GAP = "seqGap"

    // Default ports
    const val DEFAULT_PORT = 18789
    const val DEFAULT_TLS_PORT = 18790

    val ALL_CAPABILITIES = listOf(
        CAP_CAMERA, CAP_LOCATION, CAP_MICROPHONE, CAP_SMS,
        CAP_CONTACTS, CAP_CALENDAR, CAP_PHOTOS, CAP_MOTION,
        CAP_NOTIFICATIONS, CAP_TTS, CAP_CANVAS, CAP_A2UI,
    )

    val ALL_SCOPES = listOf(
        SCOPE_CHAT, SCOPE_INVOKE, SCOPE_CANVAS, SCOPE_VOICE, SCOPE_EVENTS,
    )
}

/**
 * Invoke error data class.
 */
data class InvokeError(
    val code: String,
    val message: String,
    val detail: String? = null,
)

/**
 * Parses invoke errors from gateway JSON payloads.
 */
object InvokeErrorParser {
    fun parse(element: kotlinx.serialization.json.JsonElement?): InvokeError {
        if (element == null) return InvokeError(CoreBlowProtocol.ERR_UNKNOWN, "Unknown error")
        val obj = element as? kotlinx.serialization.json.JsonObject
            ?: return InvokeError(CoreBlowProtocol.ERR_UNKNOWN, element.toString())
        val code = (obj["code"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: CoreBlowProtocol.ERR_UNKNOWN
        val message = (obj["message"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: "Unknown error"
        val detail = (obj["detail"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        return InvokeError(code, message, detail)
    }
}
