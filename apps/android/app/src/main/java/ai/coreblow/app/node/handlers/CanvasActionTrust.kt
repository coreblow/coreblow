package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Manages trust evaluation for canvas actions.
 * Determines whether a canvas action requires user confirmation
 * based on action type, sender trust level, and security policy.
 */
class CanvasActionTrust(
    private val appContext: Context,
    private val getUserTrustDecision: suspend (action: String, detail: String) -> Boolean,
) {
    companion object {
        private const val TAG = "CanvasActionTrust"

        // Actions that always require user approval
        private val REQUIRES_APPROVAL = setOf(
            "navigate.external",
            "clipboard.write",
            "share",
            "notification.send",
            "sms.send",
            "file.download",
            "payment",
        )

        // Actions that are always safe
        private val ALWAYS_SAFE = setOf(
            "canvas.render",
            "canvas.clear",
            "canvas.hide",
            "canvas.show",
            "toast",
            "haptic",
            "badge",
        )

        // Actions that are safe for trusted senders
        private val TRUSTED_SAFE = setOf(
            "dialog",
            "navigate.internal",
            "clipboard.read",
            "notification.local",
            "vibrate",
            "openUrl.internal",
        )
    }

    private val trustedSenders = mutableSetOf<String>()
    private val approvedActions = mutableSetOf<String>()

    /**
     * Evaluate whether an action should be allowed.
     */
    suspend fun evaluate(
        action: String,
        senderId: String?,
        detail: String = "",
    ): TrustDecision {
        // Always safe actions
        if (action in ALWAYS_SAFE) {
            return TrustDecision(allowed = true, reason = "safe_action")
        }

        // Check if previously approved
        val actionKey = "$senderId:$action"
        if (actionKey in approvedActions) {
            return TrustDecision(allowed = true, reason = "previously_approved")
        }

        // Trusted sender + trusted-safe action
        if (senderId != null && senderId in trustedSenders && action in TRUSTED_SAFE) {
            return TrustDecision(allowed = true, reason = "trusted_sender")
        }

        // Requires approval
        if (action in REQUIRES_APPROVAL) {
            val approved = getUserTrustDecision(action, detail)
            if (approved) {
                approvedActions.add(actionKey)
                return TrustDecision(allowed = true, reason = "user_approved")
            }
            Log.w(TAG, "User denied action: $action from $senderId")
            return TrustDecision(allowed = false, reason = "user_denied")
        }

        // Unknown action — default deny
        Log.w(TAG, "Unknown action denied by policy: $action")
        return TrustDecision(allowed = false, reason = "unknown_action")
    }

    fun addTrustedSender(senderId: String) {
        trustedSenders.add(senderId)
    }

    fun removeTrustedSender(senderId: String) {
        trustedSenders.remove(senderId)
        approvedActions.removeAll { it.startsWith("$senderId:") }
    }

    fun clearApprovals() {
        approvedActions.clear()
    }

    fun getTrustInfo(): String = buildJsonObject {
        put("trustedSenders", JsonPrimitive(trustedSenders.size))
        put("approvedActions", JsonPrimitive(approvedActions.size))
    }.toString()
}

data class TrustDecision(
    val allowed: Boolean,
    val reason: String,
)
