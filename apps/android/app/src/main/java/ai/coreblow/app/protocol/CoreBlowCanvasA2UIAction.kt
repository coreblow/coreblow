package ai.coreblow.app.protocol

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Utilities for Agent-to-UI (A2UI) canvas actions.
 *
 * Handles action name extraction from WebView payloads,
 * tag-value sanitisation for telemetry, agent message formatting,
 * and JS dispatch helpers for action-status callbacks.
 */
object CoreBlowCanvasA2UIAction {

    /**
     * Extract the action name from a user-action JSON payload.
     * Checks `name` first, then falls back to `action`.
     */
    fun extractActionName(userAction: JsonObject): String? {
        val name = (userAction["name"] as? JsonPrimitive)
            ?.content?.trim().orEmpty()
        if (name.isNotEmpty()) return name

        val action = (userAction["action"] as? JsonPrimitive)
            ?.content?.trim().orEmpty()
        return action.ifEmpty { null }
    }

    /**
     * Sanitise a value for use as a structured-log tag.
     * Only letters, digits, `_`, `-`, `.`, `:` are kept.
     */
    fun sanitizeTagValue(value: String): String {
        val trimmed = value.trim().ifEmpty { "-" }
        val normalized = trimmed.replace(" ", "_")
        val out = StringBuilder(normalized.length)
        for (c in normalized) {
            val ok = c.isLetterOrDigit() || c == '_' || c == '-' || c == '.' || c == ':'
            out.append(if (ok) c else '_')
        }
        return out.toString()
    }

    /**
     * Build the structured agent message for an A2UI action invocation.
     */
    fun formatAgentMessage(
        actionName: String,
        sessionKey: String,
        surfaceId: String,
        sourceComponentId: String,
        host: String,
        instanceId: String,
        contextJson: String?,
    ): String {
        val ctxSuffix = contextJson?.takeIf { it.isNotBlank() }
            ?.let { " ctx=$it" }.orEmpty()
        return listOf(
            "CANVAS_A2UI",
            "action=${sanitizeTagValue(actionName)}",
            "session=${sanitizeTagValue(sessionKey)}",
            "surface=${sanitizeTagValue(surfaceId)}",
            "component=${sanitizeTagValue(sourceComponentId)}",
            "host=${sanitizeTagValue(host)}",
            "instance=${sanitizeTagValue(instanceId)}$ctxSuffix",
            "default=update_canvas",
        ).joinToString(separator = " ")
    }

    /**
     * Generate a JS snippet that dispatches an action-status event
     * back into the WebView canvas.
     */
    fun jsDispatchA2UIActionStatus(actionId: String, ok: Boolean, error: String?): String {
        val err = jsonStringLiteral(error ?: "")
        val okLiteral = if (ok) "true" else "false"
        val idLiteral = jsonStringLiteral(actionId)
        return "window.dispatchEvent(new CustomEvent('coreblow:a2ui-action-status', " +
            "{ detail: { id: $idLiteral, ok: $okLiteral, error: $err } }));"
    }

    private fun jsonStringLiteral(raw: String): String =
        JsonPrimitive(raw).toString()
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029")
}
