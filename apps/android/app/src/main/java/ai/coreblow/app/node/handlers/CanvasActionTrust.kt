package ai.coreblow.app.node.handlers

/**
 * Trust levels for canvas A2UI (Agent-to-UI) actions.
 *
 * Determines which canvas operations an agent can perform
 * without explicit user confirmation.
 */
enum class CanvasActionTrust {
    /** Action is always allowed without confirmation. */
    ALLOW,
    /** Action requires user confirmation before execution. */
    PROMPT,
    /** Action is blocked and cannot be executed. */
    DENY,
}

/**
 * Evaluates trust level for canvas actions based on the action type
 * and current security context.
 */
object CanvasActionTrustEvaluator {

    /** Actions that are always safe to execute. */
    private val ALLOWED_ACTIONS = setOf(
        "render-html",
        "set-title",
        "show-toast",
        "update-badge",
    )

    /** Actions that require user confirmation. */
    private val PROMPT_ACTIONS = setOf(
        "navigate-url",
        "open-external",
        "download-file",
        "screenshot",
    )

    /** Actions that are never allowed from agents. */
    private val DENIED_ACTIONS = setOf(
        "execute-js",
        "access-storage",
        "modify-settings",
    )

    /**
     * Evaluate the trust level for a canvas action.
     */
    fun evaluate(action: String): CanvasActionTrust {
        return when {
            DENIED_ACTIONS.contains(action) -> CanvasActionTrust.DENY
            PROMPT_ACTIONS.contains(action) -> CanvasActionTrust.PROMPT
            ALLOWED_ACTIONS.contains(action) -> CanvasActionTrust.ALLOW
            else -> CanvasActionTrust.PROMPT
        }
    }

    /**
     * Check if an action is safe to execute without user prompt.
     */
    fun isSafe(action: String): Boolean = evaluate(action) == CanvasActionTrust.ALLOW
}
