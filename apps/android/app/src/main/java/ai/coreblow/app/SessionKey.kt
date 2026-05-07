package ai.coreblow.app

/**
 * Session-key utilities for the main gateway session.
 *
 * A session key identifies the active conversation scope:
 * - "main"           → default session
 * - "global"         → shared across agents
 * - "agent:<id>"     → agent-scoped session
 * - "agent:<id>:node-<device>" → device-pinned agent session
 */
object SessionKey {

    /** Default session key when none is provided. */
    const val DEFAULT = "main"
    const val GLOBAL = "global"
    private const val AGENT_PREFIX = "agent:"

    /** Normalise a raw key: null / blank → "main". */
    fun normalize(raw: String?): String {
        val trimmed = raw?.trim()
        return if (!trimmed.isNullOrEmpty()) trimmed else DEFAULT
    }

    /** True if [raw] is a canonical root session key (global or agent-scoped). */
    fun isCanonical(raw: String?): Boolean {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return false
        if (trimmed == GLOBAL) return true
        return trimmed.startsWith(AGENT_PREFIX)
    }

    /** Extract the agent-id from an "agent:<id>…" key, or null. */
    fun resolveAgentId(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (!trimmed.startsWith(AGENT_PREFIX)) return null
        return trimmed.removePrefix(AGENT_PREFIX)
            .substringBefore(':')
            .trim()
            .ifEmpty { null }
    }

    /**
     * Build a deterministic session key for this device + agent combination.
     *
     * @param deviceId the stable device identifier (first 12 chars used)
     * @param agentId  optional agent scope, defaults to "main"
     */
    fun buildForDevice(deviceId: String, agentId: String? = null): String {
        val resolvedAgent = agentId?.trim().orEmpty().ifEmpty { DEFAULT }
        return "$AGENT_PREFIX$resolvedAgent:node-${deviceId.take(12)}"
    }
}
