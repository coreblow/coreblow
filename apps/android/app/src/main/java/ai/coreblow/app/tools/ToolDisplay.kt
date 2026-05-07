package ai.coreblow.app.tools

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Resolves human-friendly display metadata for tool calls.
 *
 * Loads a `tool-display.json` asset at first use, then caches it.
 * Each tool call gets an emoji, title, label, verb, and detail
 * extracted from the call arguments according to per-tool rules.
 */

// ── Config schema ───────────────────────────────────────

@Serializable
private data class ToolDisplayActionSpec(
    val label: String? = null,
    val detailKeys: List<String>? = null,
)

@Serializable
private data class ToolDisplaySpec(
    val emoji: String? = null,
    val title: String? = null,
    val label: String? = null,
    val detailKeys: List<String>? = null,
    val actions: Map<String, ToolDisplayActionSpec>? = null,
)

@Serializable
private data class ToolDisplayConfig(
    val version: Int? = null,
    val fallback: ToolDisplaySpec? = null,
    val tools: Map<String, ToolDisplaySpec>? = null,
)

// ── Public summary model ────────────────────────────────

data class ToolDisplaySummary(
    val name: String,
    val emoji: String,
    val title: String,
    val label: String,
    val verb: String?,
    val detail: String?,
) {
    val detailLine: String?
        get() {
            val parts = mutableListOf<String>()
            if (!verb.isNullOrBlank()) parts += verb
            if (!detail.isNullOrBlank()) parts += detail
            return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
        }

    val summaryLine: String
        get() = if (detailLine != null) "$emoji $label: $detailLine" else "$emoji $label"
}

// ── Registry object ─────────────────────────────────────

object ToolDisplayRegistry {

    private const val CONFIG_ASSET = "tool-display.json"
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var cachedConfig: ToolDisplayConfig? = null

    fun resolve(
        context: Context,
        name: String?,
        args: JsonObject?,
        meta: String? = null,
    ): ToolDisplaySummary {
        val trimmedName = name?.trim().orEmpty().ifEmpty { "tool" }
        val key = trimmedName.lowercase()
        val config = loadConfig(context)
        val spec = config.tools?.get(key)
        val fallback = config.fallback

        val emoji = spec?.emoji ?: fallback?.emoji ?: "🧩"
        val title = spec?.title ?: titleFromName(trimmedName)
        val label = spec?.label ?: trimmedName

        val actionRaw = args?.get("action")?.asStringOrNull()?.trim()
        val action = actionRaw?.takeIf { it.isNotEmpty() }
        val actionSpec = action?.let { spec?.actions?.get(it) }
        val verb = normalizeVerb(actionSpec?.label ?: action)

        var detail: String? = when (key) {
            "read" -> readDetail(args)
            "write", "edit", "attach" -> pathDetail(args)
            else -> null
        }

        val detailKeys = actionSpec?.detailKeys ?: spec?.detailKeys
            ?: fallback?.detailKeys ?: emptyList()
        if (detail == null) detail = firstValue(args, detailKeys)
        if (detail == null) detail = meta
        if (detail != null) detail = shortenHomeInString(detail)

        return ToolDisplaySummary(
            name = trimmedName,
            emoji = emoji,
            title = title,
            label = label,
            verb = verb,
            detail = detail,
        )
    }

    // ── Config loading ──────────────────────────────────

    private fun loadConfig(context: Context): ToolDisplayConfig {
        cachedConfig?.let { return it }
        return try {
            val raw = context.assets.open(CONFIG_ASSET).bufferedReader().use { it.readText() }
            val decoded = json.decodeFromString(ToolDisplayConfig.serializer(), raw)
            cachedConfig = decoded
            decoded
        } catch (_: Throwable) {
            val empty = ToolDisplayConfig()
            cachedConfig = empty
            empty
        }
    }

    // ── Name formatting ─────────────────────────────────

    private fun titleFromName(name: String): String {
        val cleaned = name.replace("_", " ").trim()
        if (cleaned.isEmpty()) return "Tool"
        return cleaned.split(Regex("\\s+")).joinToString(" ") { part ->
            val upper = part.uppercase()
            if (part.length <= 2 && part == upper) part
            else upper.firstOrNull()?.toString().orEmpty() + part.lowercase().drop(1)
        }
    }

    private fun normalizeVerb(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        return trimmed.replace("_", " ").takeIf { it.isNotEmpty() }
    }

    // ── Detail extractors ───────────────────────────────

    private fun readDetail(args: JsonObject?): String? {
        val path = args?.get("path")?.asStringOrNull() ?: return null
        val offset = args["offset"].asNumberOrNull()
        val limit = args["limit"].asNumberOrNull()
        return if (offset != null && limit != null) {
            "${path}:${offset.toInt()}-${(offset + limit).toInt()}"
        } else {
            path
        }
    }

    private fun pathDetail(args: JsonObject?): String? =
        args?.get("path")?.asStringOrNull()

    private fun firstValue(args: JsonObject?, keys: List<String>): String? {
        for (key in keys) {
            val value = valueForPath(args, key)
            val rendered = renderValue(value)
            if (!rendered.isNullOrBlank()) return rendered
        }
        return null
    }

    private fun valueForPath(args: JsonObject?, path: String): JsonElement? {
        var current: JsonElement? = args
        for (segment in path.split(".")) {
            if (segment.isBlank()) return null
            current = (current as? JsonObject)?.get(segment) ?: return null
        }
        return current
    }

    private fun renderValue(value: JsonElement?): String? {
        if (value == null) return null
        if (value is JsonPrimitive) {
            if (value.isString) {
                val trimmed = value.contentOrNull?.trim().orEmpty()
                if (trimmed.isEmpty()) return null
                val firstLine = trimmed.lineSequence().firstOrNull()?.trim().orEmpty()
                if (firstLine.isEmpty()) return null
                return if (firstLine.length > 160) "${firstLine.take(157)}…" else firstLine
            }
            val raw = value.contentOrNull?.trim().orEmpty()
            raw.toBooleanStrictOrNull()?.let { return it.toString() }
            raw.toLongOrNull()?.let { return it.toString() }
            raw.toDoubleOrNull()?.let { return it.toString() }
        }
        if (value is JsonArray) {
            val items = value.mapNotNull { renderValue(it) }
            if (items.isEmpty()) return null
            val preview = items.take(3).joinToString(", ")
            return if (items.size > 3) "$preview…" else preview
        }
        return null
    }

    private fun shortenHomeInString(value: String): String {
        val home = System.getProperty("user.home")?.takeIf { it.isNotBlank() }
            ?: System.getenv("HOME")?.takeIf { it.isNotBlank() }
        if (home.isNullOrEmpty()) return value
        return value.replace(home, "~")
            .replace(Regex("/Users/[^/]+"), "~")
            .replace(Regex("/home/[^/]+"), "~")
    }

    // ── JSON helpers ────────────────────────────────────

    private fun JsonElement?.asStringOrNull(): String? {
        val primitive = this as? JsonPrimitive ?: return null
        return if (primitive.isString) primitive.contentOrNull else primitive.toString()
    }

    private fun JsonElement?.asNumberOrNull(): Double? =
        (this as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()
}
