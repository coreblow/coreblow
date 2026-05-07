package ai.coreblow.app.voice

import ai.coreblow.app.SessionKey
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

/**
 * Parsed gateway configuration for talk (voice) mode.
 */
data class TalkModeGatewayConfigState(
    val mainSessionKey: String,
    val interruptOnSpeech: Boolean?,
    val silenceTimeoutMs: Long,
)

/**
 * Parses the talk-mode section of the gateway configuration JSON.
 */
object TalkModeGatewayConfigParser {

    fun parse(config: JsonObject?): TalkModeGatewayConfigState {
        val talk = config?.get("talk").asObjectOrNull()
        val sessionCfg = config?.get("session").asObjectOrNull()
        return TalkModeGatewayConfigState(
            mainSessionKey = SessionKey.normalize(sessionCfg?.get("mainKey").asStringOrNull()),
            interruptOnSpeech = talk?.get("interruptOnSpeech").asBooleanOrNull(),
            silenceTimeoutMs = resolvedSilenceTimeoutMs(talk),
        )
    }

    fun resolvedSilenceTimeoutMs(talk: JsonObject?): Long {
        val fallback = TalkDefaults.DEFAULT_SILENCE_TIMEOUT_MS
        val primitive = talk?.get("silenceTimeoutMs") as? JsonPrimitive ?: return fallback
        if (primitive.isString) return fallback
        val timeout = primitive.content.toDoubleOrNull() ?: return fallback
        if (timeout <= 0 || timeout % 1.0 != 0.0 || timeout > Long.MAX_VALUE.toDouble()) {
            return fallback
        }
        return timeout.toLong()
    }
}

private fun JsonElement?.asStringOrNull(): String? =
    (this as? JsonPrimitive)?.contentOrNull

private fun JsonElement?.asBooleanOrNull(): Boolean? =
    (this as? JsonPrimitive)?.booleanOrNull

private fun JsonElement?.asObjectOrNull(): JsonObject? =
    this as? JsonObject
