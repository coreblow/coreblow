package ai.coreblow.app.voice

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Gateway-pushed configuration for talk mode behavior.
 *
 * Controls language, STT/TTS model selection, timing, and
 * whether audio should be streamed to the gateway in real-time.
 */
data class TalkModeGatewayConfig(
    val language: String = "en-US",
    val sttModel: String = "default",
    val ttsVoice: String = "default",
    val maxDurationMs: Long = 30_000L,
    val silenceTimeoutMs: Long = 1_500L,
    val streamAudio: Boolean = false,
    val autoRespond: Boolean = true,
) {
    companion object {
        /**
         * Parse gateway config payload into typed config.
         */
        fun fromJson(payload: JsonObject): TalkModeGatewayConfig {
            return TalkModeGatewayConfig(
                language = payload.str("language") ?: "en-US",
                sttModel = payload.str("sttModel") ?: "default",
                ttsVoice = payload.str("ttsVoice") ?: "default",
                maxDurationMs = payload.lng("maxDurationMs") ?: 30_000L,
                silenceTimeoutMs = payload.lng("silenceTimeoutMs") ?: 1_500L,
                streamAudio = payload.bool("streamAudio") ?: false,
                autoRespond = payload.bool("autoRespond") ?: true,
            )
        }

        private fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.content
        private fun JsonObject.lng(key: String) = (this[key] as? JsonPrimitive)?.content?.toLongOrNull()
        private fun JsonObject.bool(key: String) = (this[key] as? JsonPrimitive)?.content?.toBooleanStrictOrNull()
    }
}
