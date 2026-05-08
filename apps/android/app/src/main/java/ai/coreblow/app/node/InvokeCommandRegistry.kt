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
 * Availability condition for a command.
 */
enum class CommandAvailability {
    ALWAYS,
    CAMERA_ENABLED,
    LOCATION_ENABLED,
    SMS_SEND_AVAILABLE,
    SMS_READ_AVAILABLE,
    CALL_LOG_AVAILABLE,
    MOTION_ACTIVITY_AVAILABLE,
    MOTION_PEDOMETER_AVAILABLE,
    NOTIFICATIONS_AVAILABLE,
    VOICE_WAKE_ENABLED,
    DEBUG_BUILD,
}

/**
 * Availability condition for a node capability advertisement.
 */
enum class CapabilityAvailability {
    ALWAYS,
    CAMERA_ENABLED,
    LOCATION_ENABLED,
    SMS_AVAILABLE,
    CALL_LOG_AVAILABLE,
    VOICE_WAKE_ENABLED,
    MOTION_AVAILABLE,
}

/**
 * Registration entry for a node command.
 */
data class CommandEntry(
    val name: String,
    val requiresForeground: Boolean = false,
    val availability: CommandAvailability = CommandAvailability.ALWAYS,
)

/**
 * Registration entry for a node capability.
 */
data class CapabilityEntry(
    val capability: String,
    val availability: CapabilityAvailability = CapabilityAvailability.ALWAYS,
)

/**
 * Registry of all commands and capabilities supported by this node.
 *
 * Used to build the capability and command lists sent during the gateway handshake,
 * filtered by the current runtime permissions.
 */
object InvokeCommandRegistry {

    val capabilityManifest: List<CapabilityEntry> = listOf(
        CapabilityEntry(CoreBlowProtocol.CAP_CANVAS),
        CapabilityEntry(CoreBlowProtocol.CAP_DEVICE),
        CapabilityEntry(CoreBlowProtocol.CAP_NOTIFICATIONS, CapabilityAvailability.ALWAYS),
        CapabilityEntry(CoreBlowProtocol.CAP_SYSTEM),
        CapabilityEntry(CoreBlowProtocol.CAP_CAMERA, CapabilityAvailability.CAMERA_ENABLED),
        CapabilityEntry(CoreBlowProtocol.CAP_SMS, CapabilityAvailability.SMS_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_VOICE_WAKE, CapabilityAvailability.VOICE_WAKE_ENABLED),
        CapabilityEntry(CoreBlowProtocol.CAP_LOCATION, CapabilityAvailability.LOCATION_ENABLED),
        CapabilityEntry(CoreBlowProtocol.CAP_PHOTOS),
        CapabilityEntry(CoreBlowProtocol.CAP_CONTACTS),
        CapabilityEntry(CoreBlowProtocol.CAP_CALENDAR),
        CapabilityEntry(CoreBlowProtocol.CAP_MOTION, CapabilityAvailability.MOTION_AVAILABLE),
        CapabilityEntry(CoreBlowProtocol.CAP_CALL_LOG, CapabilityAvailability.CALL_LOG_AVAILABLE),
    )

    val all: List<CommandEntry> = listOf(
        // Canvas
        CommandEntry(name = "canvas.present", requiresForeground = true),
        CommandEntry(name = "canvas.hide", requiresForeground = true),
        CommandEntry(name = "canvas.navigate", requiresForeground = true),
        CommandEntry(name = "canvas.eval", requiresForeground = true),
        CommandEntry(name = "canvas.snapshot", requiresForeground = true),
        // Canvas A2UI
        CommandEntry(name = "canvas.a2ui.push", requiresForeground = true),
        CommandEntry(name = "canvas.a2ui.pushJSONL", requiresForeground = true),
        CommandEntry(name = "canvas.a2ui.reset", requiresForeground = true),
        // System
        CommandEntry(name = "system.notify"),
        // Camera
        CommandEntry(name = "camera.list", requiresForeground = true, availability = CommandAvailability.CAMERA_ENABLED),
        CommandEntry(name = "camera.snap", requiresForeground = true, availability = CommandAvailability.CAMERA_ENABLED),
        CommandEntry(name = "camera.clip", requiresForeground = true, availability = CommandAvailability.CAMERA_ENABLED),
        // Location
        CommandEntry(name = "location.get", availability = CommandAvailability.LOCATION_ENABLED),
        // Device
        CommandEntry(name = "device.status"),
        CommandEntry(name = "device.info"),
        CommandEntry(name = "device.permissions"),
        CommandEntry(name = "device.health"),
        // Notifications
        CommandEntry(name = "notifications.list"),
        CommandEntry(name = "notifications.actions"),
        // Photos
        CommandEntry(name = "photos.latest"),
        // Contacts
        CommandEntry(name = "contacts.search"),
        CommandEntry(name = "contacts.add"),
        // Calendar
        CommandEntry(name = "calendar.events"),
        CommandEntry(name = "calendar.add"),
        // Motion
        CommandEntry(name = "motion.activity", availability = CommandAvailability.MOTION_ACTIVITY_AVAILABLE),
        CommandEntry(name = "motion.pedometer", availability = CommandAvailability.MOTION_PEDOMETER_AVAILABLE),
        // SMS
        CommandEntry(name = "sms.send", availability = CommandAvailability.SMS_SEND_AVAILABLE),
        CommandEntry(name = "sms.search", availability = CommandAvailability.SMS_READ_AVAILABLE),
        // Call Log
        CommandEntry(name = "callLog.search", availability = CommandAvailability.CALL_LOG_AVAILABLE),
        // Debug
        CommandEntry(name = "debug.logs", availability = CommandAvailability.DEBUG_BUILD),
        CommandEntry(name = "debug.ed25519", availability = CommandAvailability.DEBUG_BUILD),
    )

    private val byName: Map<String, CommandEntry> = all.associateBy { it.name }

    fun find(command: String): CommandEntry? = byName[command]

    /**
     * Get the list of capabilities available given the current runtime flags.
     */
    fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> {
        return capabilityManifest
            .filter { isCapAvailable(it.availability, flags) }
            .map { it.capability }
    }

    /**
     * Get the list of commands available given the current runtime flags.
     */
    fun advertisedCommands(flags: NodeRuntimeFlags): List<String> {
        return all
            .filter { isCmdAvailable(it.availability, flags) }
            .map { it.name }
    }

    private fun isCapAvailable(availability: CapabilityAvailability, flags: NodeRuntimeFlags): Boolean {
        return when (availability) {
            CapabilityAvailability.ALWAYS -> true
            CapabilityAvailability.CAMERA_ENABLED -> flags.cameraEnabled
            CapabilityAvailability.LOCATION_ENABLED -> flags.locationEnabled
            CapabilityAvailability.SMS_AVAILABLE -> flags.sendSmsAvailable || flags.readSmsAvailable
            CapabilityAvailability.CALL_LOG_AVAILABLE -> flags.callLogAvailable
            CapabilityAvailability.VOICE_WAKE_ENABLED -> flags.voiceWakeEnabled
            CapabilityAvailability.MOTION_AVAILABLE -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
    }

    private fun isCmdAvailable(availability: CommandAvailability, flags: NodeRuntimeFlags): Boolean {
        return when (availability) {
            CommandAvailability.ALWAYS -> true
            CommandAvailability.CAMERA_ENABLED -> flags.cameraEnabled
            CommandAvailability.LOCATION_ENABLED -> flags.locationEnabled
            CommandAvailability.SMS_SEND_AVAILABLE -> flags.sendSmsAvailable
            CommandAvailability.SMS_READ_AVAILABLE -> flags.readSmsAvailable
            CommandAvailability.CALL_LOG_AVAILABLE -> flags.callLogAvailable
            CommandAvailability.MOTION_ACTIVITY_AVAILABLE -> flags.motionActivityAvailable
            CommandAvailability.MOTION_PEDOMETER_AVAILABLE -> flags.motionPedometerAvailable
            CommandAvailability.NOTIFICATIONS_AVAILABLE -> flags.notificationsAvailable
            CommandAvailability.VOICE_WAKE_ENABLED -> flags.voiceWakeEnabled
            CommandAvailability.DEBUG_BUILD -> flags.debugBuild
        }
    }
}
