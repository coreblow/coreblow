package ai.coreblow.app.chat

import ai.coreblow.app.gateway.GatewaySession
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Manages the chat state machine: history loading, message sending,
 * streaming deltas, tool call tracking, and session switching.
 */
class ChatController(
    private val scope: CoroutineScope,
    private val session: GatewaySession,
    private val json: Json,
    private val supportsChatSubscribe: Boolean,
) {
    private var appliedMainSessionKey = "main"
    private val _sessionKey = MutableStateFlow("main")
    val sessionKey: StateFlow<String> = _sessionKey.asStateFlow()

    private val _sessionId = MutableStateFlow<String?>(null)
    val sessionId: StateFlow<String?> = _sessionId.asStateFlow()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _errorText = MutableStateFlow<String?>(null)
    val errorText: StateFlow<String?> = _errorText.asStateFlow()

    private val _healthOk = MutableStateFlow(false)
    val healthOk: StateFlow<Boolean> = _healthOk.asStateFlow()

    private val _thinkingLevel = MutableStateFlow("off")
    val thinkingLevel: StateFlow<String> = _thinkingLevel.asStateFlow()

    private val _pendingRunCount = MutableStateFlow(0)
    val pendingRunCount: StateFlow<Int> = _pendingRunCount.asStateFlow()

    private val _streamingAssistantText = MutableStateFlow<String?>(null)
    val streamingAssistantText: StateFlow<String?> = _streamingAssistantText.asStateFlow()

    private val pendingToolCallsById = ConcurrentHashMap<String, ChatPendingToolCall>()
    private val _pendingToolCalls = MutableStateFlow<List<ChatPendingToolCall>>(emptyList())
    val pendingToolCalls: StateFlow<List<ChatPendingToolCall>> = _pendingToolCalls.asStateFlow()

    private val _sessions = MutableStateFlow<List<ChatSessionEntry>>(emptyList())
    val sessions: StateFlow<List<ChatSessionEntry>> = _sessions.asStateFlow()

    private val pendingRuns = mutableSetOf<String>()
    private val pendingRunTimeoutJobs = ConcurrentHashMap<String, Job>()
    private val pendingRunTimeoutMs = 120_000L
    private var lastHealthPollAtMs: Long? = null

    // MARK: - Public API

    fun onDisconnected(message: String) {
        _healthOk.value = false
        _errorText.value = null
        clearPendingRuns()
        pendingToolCallsById.clear()
        publishPendingToolCalls()
        _streamingAssistantText.value = null
        _sessionId.value = null
    }

    fun load(sessionKey: String) {
        val key = normalizeRequestedSessionKey(sessionKey)
        _sessionKey.value = key
        scope.launch { bootstrap(forceHealth = true, refreshSessions = true) }
    }

    fun applyMainSessionKey(mainSessionKey: String) {
        val trimmed = mainSessionKey.trim()
        if (trimmed.isEmpty()) return
        val nextState = applyMainSessionKeyState(
            currentSessionKey = normalizeRequestedSessionKey(_sessionKey.value),
            appliedMainSessionKey = appliedMainSessionKey,
            nextMainSessionKey = trimmed,
        )
        appliedMainSessionKey = nextState.appliedMainSessionKey
        if (_sessionKey.value == nextState.currentSessionKey) return
        _sessionKey.value = nextState.currentSessionKey
        scope.launch { bootstrap(forceHealth = true, refreshSessions = true) }
    }

    fun refresh() {
        scope.launch { bootstrap(forceHealth = true, refreshSessions = true) }
    }

    fun refreshSessions(limit: Int? = null) {
        scope.launch { fetchSessions(limit = limit) }
    }

    fun setThinkingLevel(thinkingLevel: String) {
        val normalized = normalizeThinking(thinkingLevel)
        if (normalized == _thinkingLevel.value) return
        _thinkingLevel.value = normalized
    }

    fun switchSession(sessionKey: String) {
        val key = normalizeRequestedSessionKey(sessionKey)
        if (key.isEmpty() || key == _sessionKey.value) return
        _sessionKey.value = key
        scope.launch { bootstrap(forceHealth = true, refreshSessions = false) }
    }

    fun sendMessage(message: String, thinkingLevel: String, attachments: List<OutgoingAttachment>) {
        val trimmed = message.trim()
        if (trimmed.isEmpty() && attachments.isEmpty()) return
        if (!_healthOk.value) {
            _errorText.value = "Gateway health not OK; cannot send"
            return
        }

        val runId = UUID.randomUUID().toString()
        val text = if (trimmed.isEmpty() && attachments.isNotEmpty()) "See attached." else trimmed
        val sessionKey = _sessionKey.value
        val thinking = normalizeThinking(thinkingLevel)

        // Optimistic user message
        val userContent = buildList {
            add(ChatMessageContent(type = "text", text = text))
            for (att in attachments) {
                add(ChatMessageContent(type = att.type, mimeType = att.mimeType, fileName = att.fileName, base64 = att.base64))
            }
        }
        _messages.value = _messages.value + ChatMessage(
            id = UUID.randomUUID().toString(),
            role = "user",
            content = userContent,
            timestampMs = System.currentTimeMillis(),
        )

        armPendingRunTimeout(runId)
        synchronized(pendingRuns) {
            pendingRuns.add(runId)
            _pendingRunCount.value = pendingRuns.size
        }

        _errorText.value = null
        _streamingAssistantText.value = null
        pendingToolCallsById.clear()
        publishPendingToolCalls()

        scope.launch {
            try {
                val params = buildJsonObject {
                    put("sessionKey", JsonPrimitive(sessionKey))
                    put("message", JsonPrimitive(text))
                    put("thinking", JsonPrimitive(thinking))
                    put("timeoutMs", JsonPrimitive(30_000))
                    put("idempotencyKey", JsonPrimitive(runId))
                    if (attachments.isNotEmpty()) {
                        put("attachments", JsonArray(attachments.map { att ->
                            buildJsonObject {
                                put("type", JsonPrimitive(att.type))
                                put("mimeType", JsonPrimitive(att.mimeType))
                                put("fileName", JsonPrimitive(att.fileName))
                                put("content", JsonPrimitive(att.base64))
                            }
                        }))
                    }
                }
                val res = session.request("chat.send", params.toString())
                val actualRunId = parseRunId(res) ?: runId
                if (actualRunId != runId) {
                    clearPendingRun(runId)
                    armPendingRunTimeout(actualRunId)
                    synchronized(pendingRuns) {
                        pendingRuns.add(actualRunId)
                        _pendingRunCount.value = pendingRuns.size
                    }
                }
            } catch (err: Throwable) {
                clearPendingRun(runId)
                _errorText.value = err.message
            }
        }
    }

    fun abort() {
        val runIds = synchronized(pendingRuns) { pendingRuns.toList() }
        if (runIds.isEmpty()) return
        scope.launch {
            for (runId in runIds) {
                try {
                    val params = buildJsonObject {
                        put("sessionKey", JsonPrimitive(_sessionKey.value))
                        put("runId", JsonPrimitive(runId))
                    }
                    session.request("chat.abort", params.toString())
                } catch (_: Throwable) { /* best-effort */ }
            }
        }
    }

    // MARK: - Gateway Events

    fun handleGatewayEvent(event: String, payloadJson: String?) {
        when (event) {
            "tick" -> scope.launch { pollHealthIfNeeded(force = false) }
            "health" -> _healthOk.value = true
            "seqGap" -> {
                _errorText.value = "Event stream interrupted; try refreshing."
                clearPendingRuns()
            }
            "chat" -> if (!payloadJson.isNullOrBlank()) handleChatEvent(payloadJson)
            "agent" -> if (!payloadJson.isNullOrBlank()) handleAgentEvent(payloadJson)
        }
    }

    // MARK: - Private

    private fun normalizeRequestedSessionKey(sessionKey: String): String {
        val key = sessionKey.trim()
        if (key.isEmpty()) return appliedMainSessionKey
        if (key == "main" && appliedMainSessionKey != "main") return appliedMainSessionKey
        return key
    }

    private suspend fun bootstrap(forceHealth: Boolean, refreshSessions: Boolean) {
        _errorText.value = null
        _healthOk.value = false
        clearPendingRuns()
        pendingToolCallsById.clear()
        publishPendingToolCalls()
        _streamingAssistantText.value = null
        _sessionId.value = null

        val key = _sessionKey.value
        try {
            if (supportsChatSubscribe) {
                session.sendNodeEvent("chat.subscribe", """{"sessionKey":"$key"}""")
            }
            val historyJson = session.request("chat.history", """{"sessionKey":"$key"}""")
            val history = parseHistory(historyJson, sessionKey = key, previousMessages = _messages.value)
            _messages.value = history.messages
            _sessionId.value = history.sessionId
            history.thinkingLevel?.trim()?.takeIf { it.isNotEmpty() }?.let { _thinkingLevel.value = it }
            pollHealthIfNeeded(force = forceHealth)
            if (refreshSessions) fetchSessions(limit = 50)
        } catch (err: Throwable) {
            _errorText.value = err.message
        }
    }

    private suspend fun fetchSessions(limit: Int?) {
        try {
            val params = buildJsonObject {
                put("includeGlobal", JsonPrimitive(true))
                put("includeUnknown", JsonPrimitive(false))
                if (limit != null && limit > 0) put("limit", JsonPrimitive(limit))
            }
            val res = session.request("sessions.list", params.toString())
            _sessions.value = parseSessions(res)
        } catch (_: Throwable) { /* best-effort */ }
    }

    private suspend fun pollHealthIfNeeded(force: Boolean) {
        val now = System.currentTimeMillis()
        val last = lastHealthPollAtMs
        if (!force && last != null && now - last < 10_000) return
        lastHealthPollAtMs = now
        try {
            session.request("health", null)
            _healthOk.value = true
        } catch (_: Throwable) {
            _healthOk.value = false
        }
    }

    private fun handleChatEvent(payloadJson: String) {
        val payload = payloadJson.parseJsonObject(json) ?: return
        val sessionKey = payload.stringOrNull("sessionKey")
        if (!sessionKey.isNullOrEmpty() && sessionKey != _sessionKey.value) return

        val runId = payload.stringOrNull("runId")
        val isPending = if (runId != null) synchronized(pendingRuns) { pendingRuns.contains(runId) } else true

        when (payload.stringOrNull("state")) {
            "delta" -> {
                if (!isPending) return
                val text = parseAssistantDeltaText(payload)
                if (!text.isNullOrEmpty()) _streamingAssistantText.value = text
            }
            "final", "aborted", "error" -> {
                if (payload.stringOrNull("state") == "error") {
                    _errorText.value = payload.stringOrNull("errorMessage") ?: "Chat failed"
                }
                if (runId != null) clearPendingRun(runId) else clearPendingRuns()
                pendingToolCallsById.clear()
                publishPendingToolCalls()
                _streamingAssistantText.value = null
                scope.launch {
                    try {
                        val historyJson = session.request("chat.history", """{"sessionKey":"${_sessionKey.value}"}""")
                        val history = parseHistory(historyJson, sessionKey = _sessionKey.value, previousMessages = _messages.value)
                        _messages.value = history.messages
                        _sessionId.value = history.sessionId
                    } catch (_: Throwable) { /* best-effort */ }
                }
            }
        }
    }

    private fun handleAgentEvent(payloadJson: String) {
        val payload = payloadJson.parseJsonObject(json) ?: return
        val sessionKey = payload.stringOrNull("sessionKey")
        if (!sessionKey.isNullOrEmpty() && sessionKey != _sessionKey.value) return

        val stream = payload.stringOrNull("stream")
        val data = (payload["data"] as? JsonObject)

        when (stream) {
            "assistant" -> {
                val text = data?.stringOrNull("text")
                if (!text.isNullOrEmpty()) _streamingAssistantText.value = text
            }
            "tool" -> {
                val phase = data?.stringOrNull("phase") ?: return
                val name = data.stringOrNull("name") ?: return
                val toolCallId = data.stringOrNull("toolCallId") ?: return
                val ts = (payload["ts"] as? JsonPrimitive)?.content?.toLongOrNull() ?: System.currentTimeMillis()
                if (phase == "start") {
                    pendingToolCallsById[toolCallId] = ChatPendingToolCall(
                        toolCallId = toolCallId, name = name,
                        args = data["args"] as? JsonObject, startedAtMs = ts, isError = null,
                    )
                    publishPendingToolCalls()
                } else if (phase == "result") {
                    pendingToolCallsById.remove(toolCallId)
                    publishPendingToolCalls()
                }
            }
            "error" -> {
                _errorText.value = "Event stream interrupted; try refreshing."
                clearPendingRuns()
                pendingToolCallsById.clear()
                publishPendingToolCalls()
                _streamingAssistantText.value = null
            }
        }
    }

    private fun parseAssistantDeltaText(payload: JsonObject): String? {
        val message = (payload["message"] as? JsonObject) ?: return null
        if ((message["role"] as? JsonPrimitive)?.content != "assistant") return null
        val content = (message["content"] as? JsonArray) ?: return null
        for (item in content) {
            val obj = item as? JsonObject ?: continue
            if ((obj["type"] as? JsonPrimitive)?.content != "text") continue
            val text = (obj["text"] as? JsonPrimitive)?.content
            if (!text.isNullOrEmpty()) return text
        }
        return null
    }

    private fun publishPendingToolCalls() {
        _pendingToolCalls.value = pendingToolCallsById.values.sortedBy { it.startedAtMs }
    }

    private fun armPendingRunTimeout(runId: String) {
        pendingRunTimeoutJobs[runId]?.cancel()
        pendingRunTimeoutJobs[runId] = scope.launch {
            delay(pendingRunTimeoutMs)
            if (synchronized(pendingRuns) { pendingRuns.contains(runId) }) {
                clearPendingRun(runId)
                _errorText.value = "Timed out waiting for a reply; try again or refresh."
            }
        }
    }

    private fun clearPendingRun(runId: String) {
        pendingRunTimeoutJobs.remove(runId)?.cancel()
        synchronized(pendingRuns) {
            pendingRuns.remove(runId)
            _pendingRunCount.value = pendingRuns.size
        }
    }

    private fun clearPendingRuns() {
        pendingRunTimeoutJobs.values.forEach { it.cancel() }
        pendingRunTimeoutJobs.clear()
        synchronized(pendingRuns) {
            pendingRuns.clear()
            _pendingRunCount.value = 0
        }
    }

    private fun parseHistory(historyJson: String, sessionKey: String, previousMessages: List<ChatMessage>): ChatHistory {
        val root = historyJson.parseJsonObject(json) ?: return ChatHistory(sessionKey, null, null, emptyList())
        val sid = root.stringOrNull("sessionId")
        val thinkingLevel = root.stringOrNull("thinkingLevel")
        val array = (root["messages"] as? JsonArray) ?: JsonArray(emptyList())
        val messages = array.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val role = obj.stringOrNull("role") ?: return@mapNotNull null
            val content = (obj["content"] as? JsonArray)?.mapNotNull(::parseMessageContent) ?: emptyList()
            val ts = (obj["timestamp"] as? JsonPrimitive)?.content?.toLongOrNull()
            ChatMessage(id = UUID.randomUUID().toString(), role = role, content = content, timestampMs = ts)
        }
        return ChatHistory(
            sessionKey = sessionKey,
            sessionId = sid,
            thinkingLevel = thinkingLevel,
            messages = reconcileMessageIds(previous = previousMessages, incoming = messages),
        )
    }

    private fun parseMessageContent(el: JsonElement): ChatMessageContent? {
        val obj = el as? JsonObject ?: return null
        val type = obj.stringOrNull("type") ?: "text"
        return if (type == "text") ChatMessageContent(type = "text", text = obj.stringOrNull("text"))
        else ChatMessageContent(type = type, mimeType = obj.stringOrNull("mimeType"), fileName = obj.stringOrNull("fileName"), base64 = obj.stringOrNull("content"))
    }

    private fun parseSessions(jsonString: String): List<ChatSessionEntry> {
        val root = jsonString.parseJsonObject(json) ?: return emptyList()
        val sessions = (root["sessions"] as? JsonArray) ?: return emptyList()
        return sessions.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val key = obj.stringOrNull("key")?.trim().orEmpty()
            if (key.isEmpty()) return@mapNotNull null
            ChatSessionEntry(key = key, updatedAtMs = (obj["updatedAt"] as? JsonPrimitive)?.content?.toLongOrNull(), displayName = obj.stringOrNull("displayName"))
        }
    }

    private fun parseRunId(resJson: String): String? {
        return try { resJson.parseJsonObject(json)?.stringOrNull("runId") } catch (_: Throwable) { null }
    }

    private fun normalizeThinking(raw: String): String = when (raw.trim().lowercase()) {
        "low" -> "low"; "medium" -> "medium"; "high" -> "high"; else -> "off"
    }
}

// ── Supporting Types ────────────────────────────────────

data class ChatHistory(val sessionKey: String, val sessionId: String?, val thinkingLevel: String?, val messages: List<ChatMessage>)

internal data class MainSessionState(val currentSessionKey: String, val appliedMainSessionKey: String)

internal fun applyMainSessionKeyState(currentSessionKey: String, appliedMainSessionKey: String, nextMainSessionKey: String): MainSessionState {
    return if (currentSessionKey == appliedMainSessionKey) MainSessionState(nextMainSessionKey, nextMainSessionKey)
    else MainSessionState(currentSessionKey, nextMainSessionKey)
}

// ── Message Identity Reconciliation ─────────────────────

/**
 * Reconcile incoming message IDs with previous IDs to prevent UI jank.
 *
 * When the gateway returns history after a send, the same messages appear
 * with fresh UUIDs. This function reuses existing IDs for messages that
 * match by role + timestamp + content fingerprint, keeping LazyColumn
 * keys stable and avoiding unnecessary recompositions.
 */
internal fun reconcileMessageIds(previous: List<ChatMessage>, incoming: List<ChatMessage>): List<ChatMessage> {
    if (previous.isEmpty() || incoming.isEmpty()) return incoming

    val idsByKey = LinkedHashMap<String, ArrayDeque<String>>()
    for (message in previous) {
        val key = messageIdentityKey(message) ?: continue
        idsByKey.getOrPut(key) { ArrayDeque() }.addLast(message.id)
    }

    return incoming.map { message ->
        val key = messageIdentityKey(message) ?: return@map message
        val ids = idsByKey[key] ?: return@map message
        val reusedId = ids.removeFirstOrNull() ?: return@map message
        if (ids.isEmpty()) idsByKey.remove(key)
        if (reusedId == message.id) return@map message
        message.copy(id = reusedId)
    }
}

/**
 * Build a stable identity key for a message based on role, timestamp,
 * and content fingerprint (text hash, mime type, file name, base64 hash).
 */
internal fun messageIdentityKey(message: ChatMessage): String? {
    val role = message.role.trim().lowercase()
    if (role.isEmpty()) return null

    val timestamp = message.timestampMs?.toString().orEmpty()
    val contentFingerprint = message.content.joinToString(separator = "\u001E") { part ->
        listOf(
            part.type.trim().lowercase(),
            part.text?.trim().orEmpty(),
            part.mimeType?.trim()?.lowercase().orEmpty(),
            part.fileName?.trim().orEmpty(),
            part.base64?.hashCode()?.toString().orEmpty(),
        ).joinToString(separator = "\u001F")
    }

    if (timestamp.isEmpty() && contentFingerprint.isEmpty()) return null
    return listOf(role, timestamp, contentFingerprint).joinToString(separator = "|")
}

// ── JSON Helpers ────────────────────────────────────────

internal fun String.parseJsonObject(json: Json): JsonObject? {
    return try { json.parseToJsonElement(this) as? JsonObject } catch (_: Throwable) { null }
}

internal fun JsonObject.stringOrNull(key: String): String? {
    return when (val el = this[key]) {
        is JsonNull -> null
        is JsonPrimitive -> el.content
        else -> null
    }
}
