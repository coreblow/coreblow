package ai.coreblow.app.gateway

/**
 * CoreBlow gateway-node wire protocol constants.
 *
 * Defines message types, roles, capabilities, and command namespaces
 * used for communication between the Android node and the CoreBlow gateway.
 */
object CoreBlowProtocol {

    /** Protocol version negotiated during handshake. */
    const val PROTOCOL_VERSION = 1

    // -- Message Types --

    const val MSG_HELLO = "hello"
    const val MSG_AUTH = "auth"
    const val MSG_AUTH_RESULT = "auth-result"
    const val MSG_INVOKE = "invoke"
    const val MSG_RESULT = "result"
    const val MSG_ERROR = "error"
    const val MSG_EVENT = "event"
    const val MSG_PING = "ping"
    const val MSG_PONG = "pong"
    const val MSG_BYE = "bye"

    // -- Roles --

    const val ROLE_NODE = "node"
    const val ROLE_OPERATOR = "operator"

    // -- Capabilities --

    const val CAP_CAMERA = "camera"
    const val CAP_CONTACTS = "contacts"
    const val CAP_CALENDAR = "calendar"
    const val CAP_LOCATION = "location"
    const val CAP_SMS = "sms"
    const val CAP_CALL_LOG = "call-log"
    const val CAP_PHOTOS = "photos"
    const val CAP_MOTION = "motion"
    const val CAP_NOTIFICATIONS = "notifications"
    const val CAP_CANVAS = "canvas"
    const val CAP_VOICE_WAKE = "voice-wake"
    const val CAP_DEVICE = "device"
    const val CAP_SYSTEM = "system"

    // -- Command Namespaces --

    const val NS_CAMERA = "camera"
    const val NS_CONTACTS = "contacts"
    const val NS_CALENDAR = "calendar"
    const val NS_LOCATION = "location"
    const val NS_SMS = "sms"
    const val NS_CALL_LOG = "call-log"
    const val NS_PHOTOS = "photos"
    const val NS_MOTION = "motion"
    const val NS_NOTIFICATIONS = "notifications"
    const val NS_CANVAS = "canvas"
    const val NS_DEVICE = "device"
    const val NS_SYSTEM = "system"
    const val NS_DEBUG = "debug"

    // -- Auth Sources --

    const val AUTH_DEVICE_TOKEN = "device-token"
    const val AUTH_SHARED_TOKEN = "shared-token"
    const val AUTH_BOOTSTRAP = "bootstrap"
    const val AUTH_PASSWORD = "password" // pragma: allowlist secret

    // -- Error Codes --

    const val ERR_UNKNOWN_COMMAND = "unknown-command"
    const val ERR_PERMISSION_DENIED = "permission-denied"
    const val ERR_TIMEOUT = "timeout"
    const val ERR_INTERNAL = "internal-error"
    const val ERR_NOT_AVAILABLE = "not-available"
    const val ERR_AUTH_FAILED = "auth-failed"

    // -- Client Modes --

    const val MODE_FULL = "full"
    const val MODE_LITE = "lite"

    // -- Platform --

    const val PLATFORM_ANDROID = "android"

    /** All capability identifiers in registration order. */
    val ALL_CAPABILITIES = listOf(
        CAP_CAMERA, CAP_CONTACTS, CAP_CALENDAR, CAP_LOCATION,
        CAP_SMS, CAP_CALL_LOG, CAP_PHOTOS, CAP_MOTION,
        CAP_NOTIFICATIONS, CAP_CANVAS, CAP_VOICE_WAKE,
        CAP_DEVICE, CAP_SYSTEM,
    )
}
