package ai.coreblow.app.node

import ai.coreblow.app.gateway.CoreBlowProtocol

/**
 * Runtime flags representing the current state of device permissions and capabilities.
 */
data class NodeRuntimeFlags(
    val cameraEnabled: Boolean = false,
    val locationEnabled: Boolean = false,
    val sendSmsAvailable: Boolean = false,
    val readSmsAvailable: Boolean = false,
    val callLogAvailable: Boolean = false,
    val voiceWakeEnabled: Boolean = false,
    val motionActivityAvailable: Boolean = false,
    val motionPedometerAvailable: Boolean = false,
    val notificationsAvailable: Boolean = false,
    val debugBuild: Boolean = false,
)

/**
 * Availability condition for a command or capability.
 */
enum class CommandAvailability {
    ALWAYS,
    CAMERA_ENABLED,
    LOCATION_ENABLED,
    SMS_SEND_AVAILABLE,
    SMS_READ_AVAILABLE,
    CALL_LOG_AVAILABLE,
    MOTION_AVAILABLE,
    NOTIFICATIONS_AVAILABLE,
    VOICE_WAKE_ENABLED,
    DEBUG_BUILD,
}

/**
 * Registration entry for a node command.
 */
data class CommandEntry(
    val namespace: String,
    val command: String,
    val availability: CommandAvailability = CommandAvailability.ALWAYS,
) {
    /** Full qualified command name: "namespace.command" */
    val fullName: String get() = "$namespace.$command"
}

/**
 * Registration entry for a node capability.
 */
data class CapabilityEntry(
    val capability: String,
    val availability: CommandAvailability = CommandAvailability.ALWAYS,
)

/**
 * Registry of all commands and capabilities supported by this node.
 *
 * Used to build the capability and command lists sent during the gateway handshake,
 * filtered by the current runtime permissions.
 */
object InvokeCommandRegistry {

    private val capabilities = listOf(
        CapabilityEntry(CoreBlowProtocol.CAP_DEVICE),
        CapabilityEntry(CoreBlowProtocol.CAP_SYSTEM),
        CapabilityEntry(CoreBlowProtocol.CAP_CAMERA, CommandAvailability.CAMERA_ENABLED),
        CapabilityEntry(CoreBlowProtocol.CAP_CONTACTS),
        CapabilityEntry(CoreBlowProtocol.CAP_CALENDAR),
        CapabilityEntry(CoreBlowProtocol.CAP_LOCATION, CommandAvailability.LOCATION_ENABLED),
        CapabilityEntry(CoreBlowProtocol.CAP_SMS, CommandAvailability.SMS_READ_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_CALL_LOG, CommandAvailability.CALL_LOG_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_PHOTOS),
        CapabilityEntry(CoreBlowProtocol.CAP_MOTION, CommandAvailability.MOTION_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_NOTIFICATIONS, CommandAvailability.NOTIFICATIONS_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_CANVAS),
        CapabilityEntry(CoreBlowProtocol.CAP_VOICE_WAKE, CommandAvailability.VOICE_WAKE_ENABLED),
    )

    private val commands = listOf(
        // Device
        CommandEntry(CoreBlowProtocol.NS_DEVICE, "get-info"),
        CommandEntry(CoreBlowProtocol.NS_DEVICE, "get-battery"),
        CommandEntry(CoreBlowProtocol.NS_DEVICE, "get-storage"),
        // System
        CommandEntry(CoreBlowProtocol.NS_SYSTEM, "get-clipboard"),
        CommandEntry(CoreBlowProtocol.NS_SYSTEM, "set-brightness"),
        CommandEntry(CoreBlowProtocol.NS_SYSTEM, "set-volume"),
        // Camera
        CommandEntry(CoreBlowProtocol.NS_CAMERA, "capture-photo", CommandAvailability.CAMERA_ENABLED),
        CommandEntry(CoreBlowProtocol.NS_CAMERA, "capture-video", CommandAvailability.CAMERA_ENABLED),
        // Contacts
        CommandEntry(CoreBlowProtocol.NS_CONTACTS, "list-contacts"),
        CommandEntry(CoreBlowProtocol.NS_CONTACTS, "search-contacts"),
        // Calendar
        CommandEntry(CoreBlowProtocol.NS_CALENDAR, "list-events"),
        CommandEntry(CoreBlowProtocol.NS_CALENDAR, "create-event"),
        // Location
        CommandEntry(CoreBlowProtocol.NS_LOCATION, "get-location", CommandAvailability.LOCATION_ENABLED),
        CommandEntry(CoreBlowProtocol.NS_LOCATION, "start-tracking", CommandAvailability.LOCATION_ENABLED),
        // SMS
        CommandEntry(CoreBlowProtocol.NS_SMS, "read-sms", CommandAvailability.SMS_READ_AVAILABLE),
        CommandEntry(CoreBlowProtocol.NS_SMS, "send-sms", CommandAvailability.SMS_SEND_AVAILABLE),
        // Photos
        CommandEntry(CoreBlowProtocol.NS_PHOTOS, "list-photos"),
        CommandEntry(CoreBlowProtocol.NS_PHOTOS, "get-photo"),
        // Motion
        CommandEntry(CoreBlowProtocol.NS_MOTION, "get-steps", CommandAvailability.MOTION_AVAILABLE),
        CommandEntry(CoreBlowProtocol.NS_MOTION, "get-activity", CommandAvailability.MOTION_AVAILABLE),
        // Notifications
        CommandEntry(CoreBlowProtocol.NS_NOTIFICATIONS, "list-notifications", CommandAvailability.NOTIFICATIONS_AVAILABLE),
        // Canvas
        CommandEntry(CoreBlowProtocol.NS_CANVAS, "render-html"),
        CommandEntry(CoreBlowProtocol.NS_CANVAS, "screenshot"),
        // Debug
        CommandEntry(CoreBlowProtocol.NS_DEBUG, "ping", CommandAvailability.DEBUG_BUILD),
        CommandEntry(CoreBlowProtocol.NS_DEBUG, "echo", CommandAvailability.DEBUG_BUILD),
        CommandEntry(CoreBlowProtocol.NS_DEBUG, "diagnostics", CommandAvailability.DEBUG_BUILD),
    )

    /**
     * Get the list of capabilities available given the current runtime flags.
     */
    fun availableCapabilities(flags: NodeRuntimeFlags): List<String> {
        return capabilities
            .filter { isAvailable(it.availability, flags) }
            .map { it.capability }
    }

    /**
     * Get the list of commands available given the current runtime flags.
     */
    fun availableCommands(flags: NodeRuntimeFlags): List<String> {
        return commands
            .filter { isAvailable(it.availability, flags) }
            .map { it.fullName }
    }

    private fun isAvailable(availability: CommandAvailability, flags: NodeRuntimeFlags): Boolean {
        return when (availability) {
            CommandAvailability.ALWAYS -> true
            CommandAvailability.CAMERA_ENABLED -> flags.cameraEnabled
            CommandAvailability.LOCATION_ENABLED -> flags.locationEnabled
            CommandAvailability.SMS_SEND_AVAILABLE -> flags.sendSmsAvailable
            CommandAvailability.SMS_READ_AVAILABLE -> flags.readSmsAvailable
            CommandAvailability.CALL_LOG_AVAILABLE -> flags.callLogAvailable
            CommandAvailability.MOTION_AVAILABLE -> flags.motionActivityAvailable || flags.motionPedometerAvailable
            CommandAvailability.NOTIFICATIONS_AVAILABLE -> flags.notificationsAvailable
            CommandAvailability.VOICE_WAKE_ENABLED -> flags.voiceWakeEnabled
            CommandAvailability.DEBUG_BUILD -> flags.debugBuild
        }
    }
}
