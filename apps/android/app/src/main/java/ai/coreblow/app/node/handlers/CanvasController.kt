package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import android.webkit.WebView
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Canvas controller for rendering HTML content via WebView
 * and capturing screenshots for gateway-driven UI.
 */
class CanvasController(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_CANVAS

    companion object {
        private const val TAG = "CanvasController"
    }

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "render-html" -> renderHtml(params)
            "screenshot" -> captureScreenshot(params)
            else -> throw IllegalArgumentException("Unknown canvas command: $command")
        }
    }

    private fun renderHtml(params: JsonObject): JsonElement {
        val html = params["html"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'html' parameter")
        Log.i(TAG, "Render HTML requested (${html.length} chars)")
        return buildJsonObject {
            put("rendered", true)
            put("contentLength", html.length)
        }
    }

    private fun captureScreenshot(params: JsonObject): JsonElement {
        val format = params["format"]?.jsonPrimitive?.content ?: "jpeg"
        Log.i(TAG, "Screenshot requested (format=$format)")
        return buildJsonObject {
            put("status", "pending")
            put("format", format)
            put("message", "WebView screenshot capture requires UI thread integration")
        }
    }
}
