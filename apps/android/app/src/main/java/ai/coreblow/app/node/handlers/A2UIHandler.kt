package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Handles A2UI (Agent-to-UI) actions dispatched from the gateway.
 * Routes UI mutation commands (toast, dialog, navigate, theme, badge,
 * notification, clipboard, haptic) to the appropriate Android UI handler.
 */
class A2UIHandler(
    private val appContext: Context,
    private val scope: CoroutineScope,
    private val showToast: (message: String, duration: String) -> Unit,
    private val showDialog: (title: String, message: String, actions: List<String>) -> Unit,
    private val navigateTo: (route: String, params: Map<String, String>) -> Unit,
    private val setBadge: (tab: String, count: Int) -> Unit,
    private val triggerHaptic: (style: String) -> Unit,
    private val setClipboard: (text: String) -> Unit,
    private val sendLocalNotification: (title: String, body: String, channelId: String?) -> Unit,
) {
    companion object {
        private const val TAG = "A2UIHandler"
    }

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Handle an A2UI action from a JSON payload string.
     */
    fun handleAction(payloadJson: String): String {
        return try {
            val root = json.parseToJsonElement(payloadJson).jsonObject
            val action = (root["action"] as? JsonPrimitive)?.content?.trim()
                ?: return errorResult("Missing 'action' field")
            val params = root["params"] as? JsonObject ?: JsonObject(emptyMap())

            when (action) {
                "toast" -> handleToast(params)
                "dialog" -> handleDialog(params)
                "navigate" -> handleNavigate(params)
                "badge" -> handleBadge(params)
                "haptic" -> handleHaptic(params)
                "clipboard" -> handleClipboard(params)
                "notification" -> handleNotification(params)
                "vibrate" -> handleVibrate(params)
                "openUrl" -> handleOpenUrl(params)
                "share" -> handleShare(params)
                else -> {
                    Log.w(TAG, "Unknown A2UI action: $action")
                    errorResult("Unknown action: $action")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "A2UI action failed: ${e.message}")
            errorResult(e.message ?: "Unknown error")
        }
    }

    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return when (subCommand) {
            "action" -> handleAction(params.toString())
            "capabilities" -> getCapabilities()
            else -> null
        }
    }

    fun getCapabilities(): String = buildJsonObject {
        put("toast", JsonPrimitive(true))
        put("dialog", JsonPrimitive(true))
        put("navigate", JsonPrimitive(true))
        put("badge", JsonPrimitive(true))
        put("haptic", JsonPrimitive(true))
        put("clipboard", JsonPrimitive(true))
        put("notification", JsonPrimitive(true))
        put("vibrate", JsonPrimitive(true))
        put("openUrl", JsonPrimitive(true))
        put("share", JsonPrimitive(true))
    }.toString()

    // MARK: - Action Handlers

    private fun handleToast(params: JsonObject): String {
        val message = (params["message"] as? JsonPrimitive)?.content ?: "Notification"
        val duration = (params["duration"] as? JsonPrimitive)?.content ?: "short"
        showToast(message, duration)
        return successResult()
    }

    private fun handleDialog(params: JsonObject): String {
        val title = (params["title"] as? JsonPrimitive)?.content ?: ""
        val message = (params["message"] as? JsonPrimitive)?.content ?: ""
        val actionsArray = params["actions"]
        val actions = if (actionsArray is kotlinx.serialization.json.JsonArray) {
            actionsArray.mapNotNull { (it as? JsonPrimitive)?.content }
        } else listOf("OK")
        showDialog(title, message, actions)
        return successResult()
    }

    private fun handleNavigate(params: JsonObject): String {
        val route = (params["route"] as? JsonPrimitive)?.content ?: return errorResult("Missing route")
        val navParams = mutableMapOf<String, String>()
        params.forEach { (key, value) ->
            if (key != "route" && value is JsonPrimitive) {
                navParams[key] = value.content
            }
        }
        navigateTo(route, navParams)
        return successResult()
    }

    private fun handleBadge(params: JsonObject): String {
        val tab = (params["tab"] as? JsonPrimitive)?.content ?: return errorResult("Missing tab")
        val count = (params["count"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0
        setBadge(tab, count)
        return successResult()
    }

    private fun handleHaptic(params: JsonObject): String {
        val style = (params["style"] as? JsonPrimitive)?.content ?: "light"
        triggerHaptic(style)
        return successResult()
    }

    private fun handleClipboard(params: JsonObject): String {
        val text = (params["text"] as? JsonPrimitive)?.content ?: return errorResult("Missing text")
        setClipboard(text)
        return successResult()
    }

    private fun handleNotification(params: JsonObject): String {
        val title = (params["title"] as? JsonPrimitive)?.content ?: "CoreBlow"
        val body = (params["body"] as? JsonPrimitive)?.content ?: ""
        val channelId = (params["channelId"] as? JsonPrimitive)?.content
        sendLocalNotification(title, body, channelId)
        return successResult()
    }

    private fun handleVibrate(params: JsonObject): String {
        val pattern = (params["pattern"] as? JsonPrimitive)?.content ?: "short"
        triggerHaptic(pattern)
        return successResult()
    }

    private fun handleOpenUrl(params: JsonObject): String {
        val url = (params["url"] as? JsonPrimitive)?.content ?: return errorResult("Missing url")
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            appContext.startActivity(intent)
        } catch (e: Exception) {
            return errorResult("Failed to open URL: ${e.message}")
        }
        return successResult()
    }

    private fun handleShare(params: JsonObject): String {
        val text = (params["text"] as? JsonPrimitive)?.content ?: ""
        val title = (params["title"] as? JsonPrimitive)?.content ?: "Share"
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(android.content.Intent.EXTRA_TEXT, text)
                putExtra(android.content.Intent.EXTRA_SUBJECT, title)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            appContext.startActivity(android.content.Intent.createChooser(intent, title).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            return errorResult("Failed to share: ${e.message}")
        }
        return successResult()
    }

    // MARK: - Helpers

    private fun successResult(): String = buildJsonObject { put("success", JsonPrimitive(true)) }.toString()

    private fun errorResult(message: String): String = buildJsonObject {
        put("success", JsonPrimitive(false))
        put("error", JsonPrimitive(message))
    }.toString()
}
