package ai.coreblow.app.voice

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Parsed voice directive from the gateway.
 */
sealed class TalkDirective {
    /** Speak text aloud via TTS. */
    data class Speak(val text: String, val voice: String? = null) : TalkDirective()

    /** Navigate to a screen or URL. */
    data class Navigate(val target: String) : TalkDirective()

    /** Execute an invoke command on behalf of the user. */
    data class Execute(val command: String, val params: JsonObject?) : TalkDirective()

    /** Stop talk mode and return to idle. */
    data object StopListening : TalkDirective()

    /** Play an audio response from the gateway. */
    data class PlayAudio(val url: String) : TalkDirective()

    /** Unknown directive type. */
    data class Unknown(val type: String) : TalkDirective()
}

/**
 * Parses voice directive payloads from the gateway into typed [TalkDirective] objects.
 *
 * Expected payload shape:
 * ```json
 * { "directive": "speak", "text": "Hello!", "voice": "default" }
 * ```
 */
object TalkDirectiveParser {

    fun parse(payload: JsonObject): TalkDirective {
        val directive = payload.stringOrNull("directive") ?: return TalkDirective.Unknown("missing")

        return when (directive) {
            "speak" -> TalkDirective.Speak(
                text = payload.stringOrNull("text") ?: "",
                voice = payload.stringOrNull("voice"),
            )
            "navigate" -> TalkDirective.Navigate(
                target = payload.stringOrNull("target") ?: "",
            )
            "execute" -> TalkDirective.Execute(
                command = payload.stringOrNull("command") ?: "",
                params = payload["params"] as? JsonObject,
            )
            "stop" -> TalkDirective.StopListening
            "play-audio" -> TalkDirective.PlayAudio(
                url = payload.stringOrNull("url") ?: "",
            )
            else -> TalkDirective.Unknown(directive)
        }
    }

    /**
     * Extract a command string from natural language input.
     * Simple keyword-based extraction for common patterns.
     */
    fun extractCommand(transcript: String): String? {
        val normalized = transcript.lowercase().trim()

        return when {
            normalized.startsWith("take a photo") || normalized.startsWith("capture photo") -> "camera.capture-photo"
            normalized.startsWith("where am i") || normalized.startsWith("my location") -> "location.get-location"
            normalized.startsWith("read messages") || normalized.startsWith("check sms") -> "sms.read-sms"
            normalized.startsWith("battery") || normalized.startsWith("check battery") -> "device.get-battery"
            normalized.startsWith("storage") || normalized.startsWith("check storage") -> "device.get-storage"
            normalized.startsWith("contacts") || normalized.startsWith("list contacts") -> "contacts.list-contacts"
            normalized.startsWith("calendar") || normalized.startsWith("my events") -> "calendar.list-events"
            normalized.startsWith("steps") || normalized.startsWith("step count") -> "motion.get-steps"
            else -> null
        }
    }

    private fun JsonObject.stringOrNull(key: String): String? {
        return try { this[key]?.jsonPrimitive?.content } catch (_: Exception) { null }
    }
}
