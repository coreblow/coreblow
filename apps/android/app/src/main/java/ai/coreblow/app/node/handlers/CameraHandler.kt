package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Camera handler for capturing photos and video via CameraX.
 *
 * Delegates to CameraX APIs for actual capture; this handler manages
 * the invoke protocol and result formatting.
 */
class CameraHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_CAMERA

    companion object {
        private const val TAG = "CameraHandler"
    }

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "capture-photo" -> capturePhoto(params)
            "capture-video" -> captureVideo(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private suspend fun capturePhoto(params: JsonObject): JsonElement {
        // CameraX capture integration point
        Log.i(TAG, "Capture photo requested")
        return buildJsonObject {
            put("status", "pending")
            put("message", "CameraX capture integration pending")
        }
    }

    private suspend fun captureVideo(params: JsonObject): JsonElement {
        Log.i(TAG, "Capture video requested")
        return buildJsonObject {
            put("status", "pending")
            put("message", "CameraX video capture integration pending")
        }
    }
}
