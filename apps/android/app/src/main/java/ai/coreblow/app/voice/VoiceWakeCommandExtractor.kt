package ai.coreblow.app.voice

import android.util.Log

/**
 * Extracts actionable commands from post-wake speech input.
 * Parses natural language patterns into structured intents
 * for the gateway invoke dispatcher.
 */
class VoiceWakeCommandExtractor {

    companion object {
        private const val TAG = "WakeCommandExtractor"
    }

    /**
     * Extract a structured command from speech text.
     */
    fun extract(speechText: String): WakeCommand? {
        val text = speechText.trim().lowercase()
        if (text.isEmpty()) return null

        // Try each pattern
        return tryPhotoCommand(text)
            ?: tryLocationCommand(text)
            ?: tryMessageCommand(text)
            ?: tryCalendarCommand(text)
            ?: trySettingsCommand(text)
            ?: tryNavigationCommand(text)
            ?: tryGeneralQuery(text)
    }

    private fun tryPhotoCommand(text: String): WakeCommand? {
        val patterns = listOf("take a photo", "take a picture", "capture photo", "take photo", "snap a photo", "photograph")
        if (patterns.any { text.contains(it) }) {
            val facing = if (text.contains("selfie") || text.contains("front")) "front" else "back"
            return WakeCommand("camera.capture", mapOf("facing" to facing))
        }
        return null
    }

    private fun tryLocationCommand(text: String): WakeCommand? {
        val patterns = listOf("where am i", "my location", "current location", "what's my location", "find my location")
        if (patterns.any { text.contains(it) }) {
            return WakeCommand("location.current", mapOf("geocode" to "true"))
        }
        return null
    }

    private fun tryMessageCommand(text: String): WakeCommand? {
        val sendPatterns = listOf("send a message to", "text ", "message ", "send sms to")
        for (pattern in sendPatterns) {
            if (text.startsWith(pattern)) {
                val rest = text.removePrefix(pattern).trim()
                return WakeCommand("sms.compose", mapOf("recipient_hint" to rest))
            }
        }
        val readPatterns = listOf("read my messages", "check my messages", "any new messages", "read sms")
        if (readPatterns.any { text.contains(it) }) {
            return WakeCommand("sms.read", mapOf("limit" to "5"))
        }
        return null
    }

    private fun tryCalendarCommand(text: String): WakeCommand? {
        val patterns = listOf("what's on my calendar", "my schedule", "upcoming events", "next meeting", "calendar events")
        if (patterns.any { text.contains(it) }) {
            return WakeCommand("calendar.events", mapOf("limit" to "5"))
        }
        return null
    }

    private fun trySettingsCommand(text: String): WakeCommand? {
        if (text.contains("open settings") || text.contains("go to settings")) {
            return WakeCommand("navigate", mapOf("route" to "settings"))
        }
        return null
    }

    private fun tryNavigationCommand(text: String): WakeCommand? {
        val routeMap = mapOf(
            "go to chat" to "chat",
            "open chat" to "chat",
            "go to voice" to "voice",
            "open voice" to "voice",
            "go to connect" to "connect",
            "open connect" to "connect",
        )
        for ((pattern, route) in routeMap) {
            if (text.contains(pattern)) {
                return WakeCommand("navigate", mapOf("route" to route))
            }
        }
        return null
    }

    private fun tryGeneralQuery(text: String): WakeCommand? {
        // Fallback — treat as a chat message
        if (text.length > 5) {
            return WakeCommand("chat.send", mapOf("message" to text))
        }
        return null
    }
}

/**
 * Structured wake command extracted from speech.
 */
data class WakeCommand(
    val action: String,
    val params: Map<String, String> = emptyMap(),
)
