package ai.coreblow.app.voice

import android.util.Log

/**
 * Extracts structured commands from recognized voice input.
 * Maps natural language utterances to gateway invoke commands
 * with intent parsing, slot extraction, and command routing.
 */
class VoiceWakeCommandExtractor {

    companion object {
        private const val TAG = "VoiceWakeCmdExtractor"
    }

    // Command patterns with their slot extractors
    private val commandPatterns = listOf(
        CommandPattern("send_message", listOf("send", "message", "text", "sms"), ::extractSendMessageSlots),
        CommandPattern("call", listOf("call", "phone", "dial", "ring"), ::extractCallSlots),
        CommandPattern("navigate", listOf("navigate", "directions", "go to", "take me"), ::extractNavigateSlots),
        CommandPattern("set_timer", listOf("timer", "alarm", "remind", "countdown"), ::extractTimerSlots),
        CommandPattern("set_reminder", listOf("remind", "reminder", "don't forget"), ::extractReminderSlots),
        CommandPattern("search", listOf("search", "look up", "find", "google", "what is", "who is"), ::extractSearchSlots),
        CommandPattern("weather", listOf("weather", "temperature", "forecast", "rain", "sunny"), ::extractWeatherSlots),
        CommandPattern("play_music", listOf("play", "music", "song", "playlist", "listen"), ::extractMusicSlots),
        CommandPattern("camera", listOf("take a photo", "take photo", "take picture", "selfie", "capture"), ::extractCameraSlots),
        CommandPattern("open_app", listOf("open", "launch", "start", "run"), ::extractOpenAppSlots),
        CommandPattern("volume", listOf("volume", "louder", "quieter", "mute", "unmute"), ::extractVolumeSlots),
        CommandPattern("brightness", listOf("brightness", "brighter", "dimmer", "screen"), ::extractBrightnessSlots),
    )

    /**
     * Extract a command from voice input text.
     */
    fun extract(input: String): VoiceCommand? {
        val normalized = input.trim().lowercase()
        if (normalized.isBlank()) return null

        for (pattern in commandPatterns) {
            if (pattern.keywords.any { normalized.contains(it) }) {
                val slots = pattern.slotExtractor(normalized)
                val confidence = calculateConfidence(normalized, pattern)
                if (confidence >= 0.3f) {
                    Log.d(TAG, "Matched command: ${pattern.intent} (confidence=$confidence)")
                    return VoiceCommand(
                        intent = pattern.intent,
                        rawText = input,
                        slots = slots,
                        confidence = confidence,
                    )
                }
            }
        }

        // Fallback: treat as a general query
        return VoiceCommand(
            intent = "general_query",
            rawText = input,
            slots = mapOf("query" to input.trim()),
            confidence = 0.5f,
        )
    }

    /**
     * Extract multiple commands from a compound utterance.
     */
    fun extractMultiple(input: String): List<VoiceCommand> {
        val separators = listOf(" and then ", " and also ", " then ", " also ")
        var parts = listOf(input)

        for (sep in separators) {
            parts = parts.flatMap { it.split(sep) }
        }

        return parts.mapNotNull { extract(it.trim()) }.filter { it.confidence >= 0.3f }
    }

    /**
     * Get all supported command intents.
     */
    fun getSupportedIntents(): List<String> = commandPatterns.map { it.intent }

    // MARK: - Confidence

    private fun calculateConfidence(input: String, pattern: CommandPattern): Float {
        val matchedKeywords = pattern.keywords.count { input.contains(it) }
        val keywordScore = matchedKeywords.toFloat() / pattern.keywords.size
        val lengthPenalty = if (input.length < 3) 0.5f else 1.0f
        return (keywordScore * 0.7f + 0.3f) * lengthPenalty
    }

    // MARK: - Slot extractors

    private fun extractSendMessageSlots(input: String): Map<String, String> {
        val slots = mutableMapOf<String, String>()
        val toMatch = Regex("(?:to|send to|text|message)\\s+(.+?)(?:\\s+saying|\\s+that|$)").find(input)
        toMatch?.groupValues?.getOrNull(1)?.let { slots["recipient"] = it.trim() }

        val messageMatch = Regex("(?:saying|that|message|text)\\s+(.+)$").find(input)
        messageMatch?.groupValues?.getOrNull(1)?.let { slots["message"] = it.trim() }
        return slots
    }

    private fun extractCallSlots(input: String): Map<String, String> {
        val match = Regex("(?:call|phone|dial|ring)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("contact" to it.trim()) } ?: emptyMap()
    }

    private fun extractNavigateSlots(input: String): Map<String, String> {
        val match = Regex("(?:navigate to|directions to|go to|take me to)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("destination" to it.trim()) } ?: emptyMap()
    }

    private fun extractTimerSlots(input: String): Map<String, String> {
        val slots = mutableMapOf<String, String>()
        val durationMatch = Regex("(\\d+)\\s*(minutes?|seconds?|hours?)").find(input)
        durationMatch?.let {
            slots["duration"] = it.groupValues[1]
            slots["unit"] = it.groupValues[2].trimEnd('s')
        }
        val labelMatch = Regex("(?:for|called|named)\\s+(.+)$").find(input)
        labelMatch?.groupValues?.getOrNull(1)?.let { slots["label"] = it.trim() }
        return slots
    }

    private fun extractReminderSlots(input: String): Map<String, String> {
        val slots = mutableMapOf<String, String>()
        val toMatch = Regex("(?:remind me to|remind me about|reminder to)\\s+(.+?)(?:\\s+(?:at|in|on)|$)").find(input)
        toMatch?.groupValues?.getOrNull(1)?.let { slots["task"] = it.trim() }

        val timeMatch = Regex("(?:at|in)\\s+(\\d+\\s*(?:minutes?|hours?|pm|am|o'clock))").find(input)
        timeMatch?.groupValues?.getOrNull(1)?.let { slots["time"] = it.trim() }
        return slots
    }

    private fun extractSearchSlots(input: String): Map<String, String> {
        val match = Regex("(?:search for|search|look up|find|what is|who is|what are)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("query" to it.trim()) } ?: emptyMap()
    }

    private fun extractWeatherSlots(input: String): Map<String, String> {
        val match = Regex("(?:weather|forecast|temperature)\\s+(?:in|for|at)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("location" to it.trim()) } ?: emptyMap()
    }

    private fun extractMusicSlots(input: String): Map<String, String> {
        val match = Regex("(?:play|listen to)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("query" to it.trim()) } ?: emptyMap()
    }

    private fun extractCameraSlots(input: String): Map<String, String> {
        val facing = if (input.contains("selfie") || input.contains("front")) "front" else "back"
        return mapOf("facing" to facing)
    }

    private fun extractOpenAppSlots(input: String): Map<String, String> {
        val match = Regex("(?:open|launch|start|run)\\s+(.+)$").find(input)
        return match?.groupValues?.getOrNull(1)?.let { mapOf("app" to it.trim()) } ?: emptyMap()
    }

    private fun extractVolumeSlots(input: String): Map<String, String> {
        return when {
            input.contains("mute") -> mapOf("action" to "mute")
            input.contains("unmute") -> mapOf("action" to "unmute")
            input.contains("louder") || input.contains("up") -> mapOf("action" to "up")
            input.contains("quieter") || input.contains("down") -> mapOf("action" to "down")
            else -> {
                val match = Regex("volume\\s*(\\d+)").find(input)
                match?.groupValues?.getOrNull(1)?.let { mapOf("action" to "set", "level" to it) } ?: mapOf("action" to "get")
            }
        }
    }

    private fun extractBrightnessSlots(input: String): Map<String, String> {
        return when {
            input.contains("brighter") || input.contains("up") -> mapOf("action" to "up")
            input.contains("dimmer") || input.contains("down") -> mapOf("action" to "down")
            else -> {
                val match = Regex("brightness\\s*(\\d+)").find(input)
                match?.groupValues?.getOrNull(1)?.let { mapOf("action" to "set", "level" to it) } ?: mapOf("action" to "get")
            }
        }
    }
}

private data class CommandPattern(
    val intent: String,
    val keywords: List<String>,
    val slotExtractor: (String) -> Map<String, String>,
)

data class VoiceCommand(
    val intent: String,
    val rawText: String,
    val slots: Map<String, String> = emptyMap(),
    val confidence: Float = 0f,
) {
    val hasSlots: Boolean get() = slots.isNotEmpty()
    fun getSlot(name: String): String? = slots[name]
}
