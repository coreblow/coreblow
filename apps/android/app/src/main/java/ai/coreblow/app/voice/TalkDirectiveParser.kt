package ai.coreblow.app.voice

import android.util.Log
import kotlinx.serialization.json.*

/**
 * Parses talk-mode directives from gateway responses.
 * Handles structured commands for voice session control,
 * TTS playback, audio capture, and session state changes.
 */
class TalkDirectiveParser {

    companion object {
        private const val TAG = "TalkDirectiveParser"
    }

    /**
     * Parse a raw gateway message into a TalkDirective.
     */
    fun parse(raw: String): TalkDirective? {
        return try {
            val json = Json.parseToJsonElement(raw).jsonObject
            val type = json["type"]?.jsonPrimitive?.contentOrNull ?: return null

            when (type) {
                "tts" -> parseTtsDirective(json)
                "listen" -> parseListenDirective(json)
                "stop" -> TalkDirective.Stop(json["reason"]?.jsonPrimitive?.contentOrNull ?: "requested")
                "session_start" -> parseSessionStart(json)
                "session_end" -> TalkDirective.SessionEnd(json["reason"]?.jsonPrimitive?.contentOrNull ?: "complete")
                "thinking" -> TalkDirective.Thinking(json["text"]?.jsonPrimitive?.contentOrNull ?: "")
                "tool_call" -> parseToolCall(json)
                "tool_result" -> parseToolResult(json)
                "error" -> TalkDirective.Error(
                    code = json["code"]?.jsonPrimitive?.intOrNull ?: 0,
                    message = json["message"]?.jsonPrimitive?.contentOrNull ?: "Unknown error",
                )
                "config" -> parseConfigDirective(json)
                "interrupt" -> TalkDirective.Interrupt
                "clear" -> TalkDirective.Clear
                else -> {
                    Log.w(TAG, "Unknown directive type: $type")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Parse error: ${e.message}")
            null
        }
    }

    /**
     * Parse multiple directives from a batch message.
     */
    fun parseBatch(raw: String): List<TalkDirective> {
        return try {
            val json = Json.parseToJsonElement(raw)
            if (json is JsonArray) {
                json.mapNotNull { elem ->
                    if (elem is JsonObject) parse(elem.toString())
                    else null
                }
            } else {
                listOfNotNull(parse(raw))
            }
        } catch (_: Exception) {
            listOfNotNull(parse(raw))
        }
    }

    private fun parseTtsDirective(json: JsonObject): TalkDirective.Speak {
        return TalkDirective.Speak(
            text = json["text"]?.jsonPrimitive?.contentOrNull ?: "",
            voice = json["voice"]?.jsonPrimitive?.contentOrNull,
            speed = json["speed"]?.jsonPrimitive?.floatOrNull ?: TalkDefaults.TTS_SPEECH_RATE,
            pitch = json["pitch"]?.jsonPrimitive?.floatOrNull ?: TalkDefaults.TTS_PITCH,
            isInterruptible = json["interruptible"]?.jsonPrimitive?.booleanOrNull ?: true,
            isFinal = json["final"]?.jsonPrimitive?.booleanOrNull ?: false,
            chunkIndex = json["chunkIndex"]?.jsonPrimitive?.intOrNull ?: 0,
            totalChunks = json["totalChunks"]?.jsonPrimitive?.intOrNull ?: 1,
        )
    }

    private fun parseListenDirective(json: JsonObject): TalkDirective.Listen {
        return TalkDirective.Listen(
            maxDurationMs = json["maxDurationMs"]?.jsonPrimitive?.longOrNull ?: (TalkDefaults.MAX_RECORDING_DURATION_SEC * 1000L),
            language = json["language"]?.jsonPrimitive?.contentOrNull ?: "auto",
            sensitivity = json["sensitivity"]?.jsonPrimitive?.floatOrNull ?: 1.0f,
            silenceThreshold = json["silenceThreshold"]?.jsonPrimitive?.doubleOrNull ?: TalkDefaults.SILENCE_THRESHOLD_RMS,
            autoStop = json["autoStop"]?.jsonPrimitive?.booleanOrNull ?: true,
        )
    }

    private fun parseSessionStart(json: JsonObject): TalkDirective.SessionStart {
        return TalkDirective.SessionStart(
            sessionId = json["sessionId"]?.jsonPrimitive?.contentOrNull ?: "",
            model = json["model"]?.jsonPrimitive?.contentOrNull,
            greeting = json["greeting"]?.jsonPrimitive?.contentOrNull,
            capabilities = json["capabilities"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
        )
    }

    private fun parseToolCall(json: JsonObject): TalkDirective.ToolCall {
        return TalkDirective.ToolCall(
            id = json["id"]?.jsonPrimitive?.contentOrNull ?: "",
            name = json["name"]?.jsonPrimitive?.contentOrNull ?: "",
            args = json["args"]?.jsonObject ?: JsonObject(emptyMap()),
        )
    }

    private fun parseToolResult(json: JsonObject): TalkDirective.ToolResult {
        return TalkDirective.ToolResult(
            id = json["id"]?.jsonPrimitive?.contentOrNull ?: "",
            name = json["name"]?.jsonPrimitive?.contentOrNull ?: "",
            result = json["result"]?.jsonPrimitive?.contentOrNull ?: "",
            isSuccess = json["success"]?.jsonPrimitive?.booleanOrNull ?: true,
        )
    }

    private fun parseConfigDirective(json: JsonObject): TalkDirective.Config {
        return TalkDirective.Config(
            enableTts = json["enableTts"]?.jsonPrimitive?.booleanOrNull,
            ttsVoice = json["ttsVoice"]?.jsonPrimitive?.contentOrNull,
            ttsSpeed = json["ttsSpeed"]?.jsonPrimitive?.floatOrNull,
            vadSensitivity = json["vadSensitivity"]?.jsonPrimitive?.floatOrNull,
            silenceThreshold = json["silenceThreshold"]?.jsonPrimitive?.doubleOrNull,
            language = json["language"]?.jsonPrimitive?.contentOrNull,
        )
    }
}

/**
 * Sealed hierarchy for talk-mode directives.
 */
sealed class TalkDirective {
    data class Speak(
        val text: String,
        val voice: String? = null,
        val speed: Float = 1.0f,
        val pitch: Float = 1.0f,
        val isInterruptible: Boolean = true,
        val isFinal: Boolean = false,
        val chunkIndex: Int = 0,
        val totalChunks: Int = 1,
    ) : TalkDirective()

    data class Listen(
        val maxDurationMs: Long = 60_000,
        val language: String = "auto",
        val sensitivity: Float = 1.0f,
        val silenceThreshold: Double = 350.0,
        val autoStop: Boolean = true,
    ) : TalkDirective()

    data class Stop(val reason: String) : TalkDirective()
    data class SessionStart(val sessionId: String, val model: String?, val greeting: String?, val capabilities: List<String>) : TalkDirective()
    data class SessionEnd(val reason: String) : TalkDirective()
    data class Thinking(val text: String) : TalkDirective()

    data class ToolCall(val id: String, val name: String, val args: JsonObject) : TalkDirective()
    data class ToolResult(val id: String, val name: String, val result: String, val isSuccess: Boolean) : TalkDirective()

    data class Error(val code: Int, val message: String) : TalkDirective()

    data class Config(
        val enableTts: Boolean? = null,
        val ttsVoice: String? = null,
        val ttsSpeed: Float? = null,
        val vadSensitivity: Float? = null,
        val silenceThreshold: Double? = null,
        val language: String? = null,
    ) : TalkDirective()

    data object Interrupt : TalkDirective()
    data object Clear : TalkDirective()
}
