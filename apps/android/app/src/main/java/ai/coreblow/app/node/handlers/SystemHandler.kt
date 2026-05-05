package ai.coreblow.app.node.handlers

import android.content.ClipboardManager
import android.content.Context
import android.media.AudioManager
import android.provider.Settings
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class SystemHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_SYSTEM

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "get-clipboard" -> getClipboard()
            "set-brightness" -> setBrightness(params)
            "set-volume" -> setVolume(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun getClipboard(): JsonElement {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = clipboard.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
        return buildJsonObject { put("text", text) }
    }

    private fun setBrightness(params: JsonObject): JsonElement {
        val value = params["value"]?.jsonPrimitive?.content?.toIntOrNull()
            ?: throw IllegalArgumentException("Missing 'value' parameter")
        val clamped = value.coerceIn(0, 255)
        Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, clamped)
        return buildJsonObject { put("brightness", clamped) }
    }

    private fun setVolume(params: JsonObject): JsonElement {
        val value = params["value"]?.jsonPrimitive?.content?.toIntOrNull()
            ?: throw IllegalArgumentException("Missing 'value' parameter")
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val maxVolume = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val clamped = value.coerceIn(0, maxVolume)
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, clamped, 0)
        return buildJsonObject { put("volume", clamped); put("max", maxVolume) }
    }
}
