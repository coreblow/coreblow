package ai.coreblow.app.node.handlers

import android.content.Context
import android.service.notification.StatusBarNotification
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class NotificationsHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_NOTIFICATIONS

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "list-notifications" -> listNotifications()
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun listNotifications(): JsonElement {
        return buildJsonObject {
            put("status", "pending")
            put("message", "NotificationListenerService integration required")
        }
    }
}
