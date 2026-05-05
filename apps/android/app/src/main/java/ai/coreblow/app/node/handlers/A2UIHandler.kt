package ai.coreblow.app.node.handlers

import android.util.Log
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Handles Agent-to-UI (A2UI) actions from the gateway.
 *
 * A2UI actions allow agents to drive UI changes on the Android node,
 * such as displaying toasts, updating badges, or navigating screens.
 * Each action is evaluated against [CanvasActionTrustEvaluator] before execution.
 */
class A2UIHandler : InvokeHandler {
    override val namespace = "a2ui"

    companion object {
        private const val TAG = "A2UIHandler"
    }

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        val trust = CanvasActionTrustEvaluator.evaluate(command)

        if (trust == CanvasActionTrust.DENY) {
            Log.w(TAG, "A2UI action denied: $command")
            return buildJsonObject {
                put("executed", false)
                put("reason", "Action '$command' is not permitted")
            }
        }

        if (trust == CanvasActionTrust.PROMPT) {
            Log.i(TAG, "A2UI action requires confirmation: $command")
            return buildJsonObject {
                put("executed", false)
                put("reason", "User confirmation required for '$command'")
                put("promptRequired", true)
            }
        }

        return when (command) {
            "show-toast" -> showToast(params)
            "update-badge" -> updateBadge(params)
            "set-title" -> setTitle(params)
            "render-html" -> renderHtml(params)
            else -> buildJsonObject {
                put("executed", false)
                put("reason", "Unknown A2UI action: $command")
            }
        }
    }

    private fun showToast(params: JsonObject): JsonElement {
        val message = params["message"]?.jsonPrimitive?.content ?: ""
        Log.i(TAG, "Show toast: $message")
        return buildJsonObject { put("executed", true); put("action", "show-toast") }
    }

    private fun updateBadge(params: JsonObject): JsonElement {
        val count = params["count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        Log.i(TAG, "Update badge: $count")
        return buildJsonObject { put("executed", true); put("badge", count) }
    }

    private fun setTitle(params: JsonObject): JsonElement {
        val title = params["title"]?.jsonPrimitive?.content ?: ""
        Log.i(TAG, "Set title: $title")
        return buildJsonObject { put("executed", true); put("title", title) }
    }

    private fun renderHtml(params: JsonObject): JsonElement {
        val html = params["html"]?.jsonPrimitive?.content ?: ""
        Log.i(TAG, "Render HTML (${html.length} chars)")
        return buildJsonObject { put("executed", true); put("contentLength", html.length) }
    }
}
