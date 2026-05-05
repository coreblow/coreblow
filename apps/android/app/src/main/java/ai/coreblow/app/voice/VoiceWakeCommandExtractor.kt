package ai.coreblow.app.voice

/**
 * Extracts structured commands from voice transcripts.
 *
 * Maps natural language patterns to gateway invoke commands.
 * Separates extraction logic from directive parsing for testability.
 */
object VoiceWakeCommandExtractor {

    private val PATTERNS = listOf(
        CommandPattern("camera.capture-photo", listOf("take a photo", "capture photo", "take picture", "snap a photo")),
        CommandPattern("camera.capture-video", listOf("record video", "take a video", "capture video")),
        CommandPattern("location.get-location", listOf("where am i", "my location", "current location", "gps")),
        CommandPattern("sms.read-sms", listOf("read messages", "check sms", "read sms", "inbox")),
        CommandPattern("sms.send-sms", listOf("send message", "send sms", "text message")),
        CommandPattern("device.get-battery", listOf("battery", "check battery", "battery level", "power level")),
        CommandPattern("device.get-storage", listOf("storage", "check storage", "disk space", "free space")),
        CommandPattern("device.get-info", listOf("device info", "phone info", "about device")),
        CommandPattern("contacts.list-contacts", listOf("contacts", "list contacts", "my contacts", "phone book")),
        CommandPattern("contacts.search-contacts", listOf("find contact", "search contact", "look up")),
        CommandPattern("calendar.list-events", listOf("calendar", "my events", "upcoming events", "schedule")),
        CommandPattern("calendar.create-event", listOf("create event", "add event", "schedule meeting")),
        CommandPattern("photos.list-photos", listOf("my photos", "list photos", "photo gallery", "pictures")),
        CommandPattern("motion.get-steps", listOf("steps", "step count", "how many steps", "pedometer")),
        CommandPattern("notifications.list-notifications", listOf("notifications", "my notifications", "alerts")),
        CommandPattern("system.get-clipboard", listOf("clipboard", "paste", "what did i copy")),
        CommandPattern("debug.ping", listOf("ping", "ping gateway", "test connection")),
        CommandPattern("debug.diagnostics", listOf("diagnostics", "system check", "health check")),
    )

    /**
     * Extract a command from a voice transcript.
     * Returns null if no command pattern matches.
     */
    fun extract(transcript: String): ExtractionResult? {
        val normalized = transcript.lowercase().trim()
        if (normalized.isBlank()) return null

        for (pattern in PATTERNS) {
            for (phrase in pattern.phrases) {
                if (normalized.startsWith(phrase) || normalized.contains(phrase)) {
                    val remainder = normalized.removePrefix(phrase).trim()
                    return ExtractionResult(
                        command = pattern.command,
                        matchedPhrase = phrase,
                        remainder = remainder.ifBlank { null },
                        confidence = if (normalized.startsWith(phrase)) 1.0f else 0.8f,
                    )
                }
            }
        }
        return null
    }

    /**
     * Get all supported voice commands for display.
     */
    fun supportedCommands(): List<String> = PATTERNS.map { it.command }
}

data class CommandPattern(val command: String, val phrases: List<String>)

data class ExtractionResult(
    val command: String,
    val matchedPhrase: String,
    val remainder: String?,
    val confidence: Float,
)
