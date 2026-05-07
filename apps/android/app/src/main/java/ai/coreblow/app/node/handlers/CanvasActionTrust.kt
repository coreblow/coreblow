package ai.coreblow.app.node.handlers

import android.util.Log
import kotlinx.serialization.json.*

/**
 * Validates trust levels for canvas/UI actions invoked by agents.
 * Prevents unauthorized agents from performing destructive UI operations
 * (e.g., deleting data, navigating away, file system access).
 *
 * Trust levels:
 * - UNTRUSTED: read-only, no side effects
 * - BASIC: view rendering, styling changes
 * - ELEVATED: data modifications, navigation
 * - FULL: all operations including destructive actions
 */
class CanvasActionTrust {

    companion object {
        private const val TAG = "CanvasActionTrust"
    }

    private val agentTrustLevels = mutableMapOf<String, TrustLevel>()
    private val actionLog = ArrayDeque<ActionLogEntry>(100)
    private val blockedActions = mutableListOf<String>()

    /**
     * Check if an agent is allowed to perform an action.
     */
    fun isAllowed(agentId: String, action: String, namespace: String = "canvas"): TrustDecision {
        val trustLevel = agentTrustLevels[agentId] ?: TrustLevel.UNTRUSTED
        val requiredLevel = getRequiredTrustLevel(action, namespace)

        val allowed = trustLevel.ordinal >= requiredLevel.ordinal
        val decision = TrustDecision(
            allowed = allowed,
            agentId = agentId,
            action = action,
            namespace = namespace,
            agentTrust = trustLevel,
            requiredTrust = requiredLevel,
            reason = if (allowed) "Permitted" else "Agent trust level $trustLevel insufficient (requires $requiredLevel)",
        )

        logAction(decision)

        if (!allowed) {
            Log.w(TAG, "BLOCKED: $agentId tried $namespace.$action (has=$trustLevel, needs=$requiredLevel)")
        }

        return decision
    }

    /**
     * Set trust level for an agent.
     */
    fun setTrustLevel(agentId: String, level: TrustLevel) {
        agentTrustLevels[agentId] = level
        Log.i(TAG, "Trust level set: $agentId → $level")
    }

    /**
     * Get trust level for an agent.
     */
    fun getTrustLevel(agentId: String): TrustLevel {
        return agentTrustLevels[agentId] ?: TrustLevel.UNTRUSTED
    }

    /**
     * Revoke trust for an agent.
     */
    fun revokeTrust(agentId: String) {
        agentTrustLevels.remove(agentId)
        Log.i(TAG, "Trust revoked: $agentId")
    }

    /**
     * Get required trust level for a specific action.
     */
    fun getRequiredTrustLevel(action: String, namespace: String = "canvas"): TrustLevel {
        // Destructive actions require FULL trust
        val destructiveActions = setOf(
            "delete", "remove", "clear", "destroy", "reset",
            "format", "wipe", "uninstall", "revoke",
        )
        if (destructiveActions.any { action.lowercase().contains(it) }) return TrustLevel.FULL

        // Data modification actions require ELEVATED trust
        val modifyActions = setOf(
            "update", "edit", "modify", "write", "create", "insert",
            "send", "post", "submit", "save", "move", "rename",
        )
        if (modifyActions.any { action.lowercase().contains(it) }) return TrustLevel.ELEVATED

        // UI rendering actions require BASIC trust
        val renderActions = setOf(
            "render", "display", "show", "hide", "style",
            "animate", "scroll", "resize", "layout", "theme",
        )
        if (renderActions.any { action.lowercase().contains(it) }) return TrustLevel.BASIC

        // Read-only actions are UNTRUSTED level
        val readActions = setOf(
            "get", "read", "list", "query", "search",
            "count", "check", "info", "status", "describe",
        )
        if (readActions.any { action.lowercase().contains(it) }) return TrustLevel.UNTRUSTED

        // Default to ELEVATED for unknown actions
        return TrustLevel.ELEVATED
    }

    /**
     * Get all trust levels as JSON.
     */
    fun getTrustReport(): String {
        return buildJsonObject {
            put("agents", buildJsonArray {
                agentTrustLevels.forEach { (id, level) ->
                    add(buildJsonObject {
                        put("agentId", id)
                        put("trustLevel", level.name)
                        put("ordinal", level.ordinal)
                    })
                }
            })
            put("blockedCount", blockedActions.size)
            put("logSize", actionLog.size)
        }.toString()
    }

    /**
     * Get recent action log.
     */
    fun getActionLog(count: Int = 20): String {
        return buildJsonObject {
            put("entries", buildJsonArray {
                actionLog.takeLast(count).forEach { entry ->
                    add(buildJsonObject {
                        put("agentId", entry.agentId)
                        put("action", entry.action)
                        put("allowed", entry.allowed)
                        put("reason", entry.reason)
                        put("timestampMs", entry.timestampMs)
                    })
                }
            })
        }.toString()
    }

    /**
     * Block a specific action globally.
     */
    fun blockAction(action: String) {
        if (action !in blockedActions) blockedActions.add(action)
    }

    /**
     * Unblock a specific action.
     */
    fun unblockAction(action: String) {
        blockedActions.remove(action)
    }

    /**
     * Clear all trust levels.
     */
    fun clearAllTrust() {
        agentTrustLevels.clear()
        Log.i(TAG, "All trust levels cleared")
    }

    private fun logAction(decision: TrustDecision) {
        if (actionLog.size >= 100) actionLog.removeFirst()
        actionLog.addLast(ActionLogEntry(
            agentId = decision.agentId,
            action = decision.action,
            allowed = decision.allowed,
            reason = decision.reason,
            timestampMs = System.currentTimeMillis(),
        ))
    }
}

enum class TrustLevel {
    UNTRUSTED, BASIC, ELEVATED, FULL,
}

data class TrustDecision(
    val allowed: Boolean,
    val agentId: String,
    val action: String,
    val namespace: String,
    val agentTrust: TrustLevel,
    val requiredTrust: TrustLevel,
    val reason: String,
)

private data class ActionLogEntry(
    val agentId: String,
    val action: String,
    val allowed: Boolean,
    val reason: String,
    val timestampMs: Long,
)
