package ai.coreblow.app.node

import android.util.Log
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.voice.TalkModeManager
import ai.coreblow.app.voice.MicCaptureManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Routes gateway events to the appropriate subsystem handler.
 * Centralizes event fan-out from GatewaySession to voice, chat,
 * canvas, notification, and status subsystems.
 */
class GatewayEventHandler(
    private val talkModeManager: TalkModeManager?,
    private val micCaptureManager: MicCaptureManager?,
    private val onChatEvent: ((String) -> Unit)?,
    private val onCanvasMessage: ((String) -> Unit)?,
    private val onNotification: ((String, String) -> Unit)?,
    private val onStatusUpdate: ((String) -> Unit)?,
    private val onConnectionChanged: ((Boolean) -> Unit)?,
) {
    companion object {
        private const val TAG = "GatewayEventHandler"
    }

    private val json = Json { ignoreUnknownKeys = true }
    private var lastEventSeq: Long = -1
    private var missedEventCount = 0

    /**
     * Handle an event from the gateway session.
     */
    fun handleEvent(eventType: String, payloadJson: String?) {
        Log.d(TAG, "Event: $eventType (${payloadJson?.take(100) ?: "null"})")

        when (eventType) {
            // Voice events
            CoreBlowProtocol.EVT_CHAT -> {
                talkModeManager?.handleGatewayEvent("chat", payloadJson)
                micCaptureManager?.handleGatewayEvent("chat", payloadJson)
                onChatEvent?.invoke(payloadJson ?: "{}")
            }
            CoreBlowProtocol.EVT_VOICE_TRANSCRIPT -> {
                micCaptureManager?.handleGatewayEvent("voice.transcript", payloadJson)
            }
            CoreBlowProtocol.EVT_VOICE_DIRECTIVE -> {
                talkModeManager?.handleGatewayEvent("voice.directive", payloadJson)
            }
            CoreBlowProtocol.EVT_VOICE_CANCEL -> {
                micCaptureManager?.handleGatewayEvent("voice.cancel", payloadJson)
            }
            CoreBlowProtocol.EVT_TTS_AUDIO -> {
                talkModeManager?.handleGatewayEvent("tts.audio", payloadJson)
            }

            // Canvas events
            CoreBlowProtocol.EVT_CANVAS_MESSAGE -> {
                onCanvasMessage?.invoke(payloadJson ?: "{}")
            }

            // Status events
            CoreBlowProtocol.EVT_STATUS -> {
                onStatusUpdate?.invoke(payloadJson ?: "{}")
            }

            // Notification events
            CoreBlowProtocol.EVT_NOTIFICATION -> {
                handleNotificationEvent(payloadJson)
            }

            // Sequence gap (internal)
            CoreBlowProtocol.EVT_SEQ_GAP -> {
                missedEventCount++
                Log.w(TAG, "Sequence gap detected (total missed: $missedEventCount)")
            }

            else -> {
                Log.d(TAG, "Unhandled event type: $eventType")
            }
        }
    }

    /**
     * Handle gateway connection state changes.
     */
    fun onConnectionChanged(connected: Boolean) {
        if (!connected) {
            lastEventSeq = -1
            missedEventCount = 0
        }
        talkModeManager?.onGatewayConnectionChanged(connected)
        micCaptureManager?.onGatewayConnectionChanged(connected)
        onConnectionChanged?.invoke(connected)
    }

    /**
     * Get diagnostics about event handling.
     */
    fun getDiagnostics(): Map<String, Any> = mapOf(
        "lastEventSeq" to lastEventSeq,
        "missedEventCount" to missedEventCount,
    )

    // MARK: - Private

    private fun handleNotificationEvent(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        try {
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val title = (root["title"] as? JsonPrimitive)?.content ?: "CoreBlow"
            val body = (root["body"] as? JsonPrimitive)?.content ?: ""
            onNotification?.invoke(title, body)
        } catch (_: Throwable) {}
    }
}
