package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Canvas state for tracking render payloads.
 */
data class CanvasState(
    val html: String? = null,
    val url: String? = null,
    val title: String? = null,
    val isVisible: Boolean = false,
    val lastRenderMs: Long = 0,
    val sessionKey: String? = null,
)

/**
 * Controls the Canvas WebView for gateway-driven UI rendering.
 * Manages render payloads, URL loading, JS injection, canvas
 * visibility, and bi-directional message passing.
 */
class CanvasController(
    private val appContext: Context,
    private val scope: CoroutineScope,
    private val onCanvasVisibilityChanged: (Boolean) -> Unit,
) {
    companion object {
        private const val TAG = "CanvasController"
        private const val MAX_HTML_SIZE = 512_000
    }

    private val json = Json { ignoreUnknownKeys = true }

    private val _canvasState = MutableStateFlow(CanvasState())
    val canvasState: StateFlow<CanvasState> = _canvasState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var webViewRef: WebView? = null
    private val pendingJs = mutableListOf<String>()

    // MARK: - WebView Binding

    fun attachWebView(webView: WebView) {
        webViewRef = webView
        // Flush pending JS
        if (pendingJs.isNotEmpty()) {
            pendingJs.forEach { evaluateJs(it) }
            pendingJs.clear()
        }
    }

    fun detachWebView() {
        webViewRef = null
    }

    // MARK: - Render

    fun render(payloadJson: String): String {
        return try {
            val root = json.parseToJsonElement(payloadJson).jsonObject
            val type = (root["type"] as? JsonPrimitive)?.content ?: "html"

            when (type) {
                "html" -> renderHtml(root)
                "url" -> renderUrl(root)
                "clear" -> clearCanvas()
                "hide" -> hideCanvas()
                "show" -> showCanvas()
                "js" -> injectJs(root)
                "message" -> postMessage(root)
                else -> errorResult("Unknown canvas render type: $type")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Canvas render failed: ${e.message}")
            errorResult(e.message ?: "Unknown error")
        }
    }

    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return when (subCommand) {
            "render" -> render(params.toString())
            "clear" -> clearCanvas()
            "hide" -> hideCanvas()
            "show" -> showCanvas()
            "state" -> getStateJson()
            else -> null
        }
    }

    // MARK: - Render Types

    private fun renderHtml(root: JsonObject): String {
        val html = (root["html"] as? JsonPrimitive)?.content ?: return errorResult("Missing html")
        if (html.length > MAX_HTML_SIZE) return errorResult("HTML too large (${html.length} > $MAX_HTML_SIZE)")

        val title = (root["title"] as? JsonPrimitive)?.content
        val sessionKey = (root["sessionKey"] as? JsonPrimitive)?.content

        _canvasState.value = _canvasState.value.copy(
            html = html,
            url = null,
            title = title,
            isVisible = true,
            lastRenderMs = System.currentTimeMillis(),
            sessionKey = sessionKey,
        )

        scope.launch(Dispatchers.Main) {
            _isLoading.value = true
            webViewRef?.loadDataWithBaseURL(
                "https://canvas.coreblow.local",
                wrapHtml(html, title),
                "text/html",
                "UTF-8",
                null,
            )
            _isLoading.value = false
        }

        onCanvasVisibilityChanged(true)
        return successResult()
    }

    private fun renderUrl(root: JsonObject): String {
        val url = (root["url"] as? JsonPrimitive)?.content ?: return errorResult("Missing url")
        val title = (root["title"] as? JsonPrimitive)?.content

        _canvasState.value = _canvasState.value.copy(
            html = null,
            url = url,
            title = title,
            isVisible = true,
            lastRenderMs = System.currentTimeMillis(),
        )

        scope.launch(Dispatchers.Main) {
            _isLoading.value = true
            webViewRef?.loadUrl(url)
            _isLoading.value = false
        }

        onCanvasVisibilityChanged(true)
        return successResult()
    }

    private fun injectJs(root: JsonObject): String {
        val code = (root["code"] as? JsonPrimitive)?.content ?: return errorResult("Missing code")
        evaluateJs(code)
        return successResult()
    }

    private fun postMessage(root: JsonObject): String {
        val data = root["data"]?.toString() ?: "{}"
        evaluateJs("window.postMessage($data, '*');")
        return successResult()
    }

    // MARK: - Visibility

    private fun showCanvas(): String {
        _canvasState.value = _canvasState.value.copy(isVisible = true)
        onCanvasVisibilityChanged(true)
        return successResult()
    }

    private fun hideCanvas(): String {
        _canvasState.value = _canvasState.value.copy(isVisible = false)
        onCanvasVisibilityChanged(false)
        return successResult()
    }

    private fun clearCanvas(): String {
        _canvasState.value = CanvasState()
        scope.launch(Dispatchers.Main) {
            webViewRef?.loadUrl("about:blank")
        }
        onCanvasVisibilityChanged(false)
        return successResult()
    }

    // MARK: - JS Bridge

    private fun evaluateJs(code: String) {
        val wv = webViewRef
        if (wv == null) {
            pendingJs.add(code)
            return
        }
        scope.launch(Dispatchers.Main) {
            wv.evaluateJavascript(code, null)
        }
    }

    /**
     * Called from WebView JS bridge when canvas sends a message.
     */
    fun onMessageFromCanvas(messageJson: String) {
        Log.d(TAG, "Message from canvas: ${messageJson.take(200)}")
        // Forward to gateway via NodeRuntime event sink
    }

    // MARK: - Helpers

    private fun wrapHtml(html: String, title: String?): String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>${title ?: "Canvas"}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                @media (prefers-color-scheme: dark) {
                    body { background: #1a1a1a; color: #e0e0e0; }
                }
            </style>
            <script>
                window.CoreBlow = {
                    sendMessage: function(data) {
                        if (window.CoreBlowBridge) {
                            window.CoreBlowBridge.onMessage(JSON.stringify(data));
                        }
                    }
                };
            </script>
        </head>
        <body>$html</body>
        </html>
        """.trimIndent()
    }

    private fun getStateJson(): String = buildJsonObject {
        val state = _canvasState.value
        put("isVisible", JsonPrimitive(state.isVisible))
        put("hasContent", JsonPrimitive(state.html != null || state.url != null))
        state.title?.let { put("title", JsonPrimitive(it)) }
        state.url?.let { put("url", JsonPrimitive(it)) }
        state.sessionKey?.let { put("sessionKey", JsonPrimitive(it)) }
        put("lastRenderMs", JsonPrimitive(state.lastRenderMs))
    }.toString()

    private fun successResult(): String = buildJsonObject { put("success", JsonPrimitive(true)) }.toString()
    private fun errorResult(msg: String): String = buildJsonObject {
        put("success", JsonPrimitive(false))
        put("error", JsonPrimitive(msg))
    }.toString()
}
