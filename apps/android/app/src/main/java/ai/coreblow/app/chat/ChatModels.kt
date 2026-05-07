package ai.coreblow.app.chat

import kotlinx.serialization.json.JsonObject

/**
 * Core data models for the chat subsystem.
 *
 * These mirror the gateway protocol's chat message schema and are
 * used by [ChatController] and the Compose chat UI layer.
 */

data class ChatMessage(
    val id: String,
    val role: String,
    val content: List<ChatMessageContent>,
    val timestampMs: Long?,
)

data class ChatMessageContent(
    val type: String = "text",
    val text: String? = null,
    val mimeType: String? = null,
    val fileName: String? = null,
    val base64: String? = null,
)

data class ChatPendingToolCall(
    val toolCallId: String,
    val name: String,
    val args: JsonObject? = null,
    val startedAtMs: Long,
    val isError: Boolean? = null,
)

data class ChatSessionEntry(
    val key: String,
    val updatedAtMs: Long?,
    val displayName: String? = null,
)

data class ChatHistory(
    val sessionKey: String,
    val sessionId: String?,
    val thinkingLevel: String?,
    val messages: List<ChatMessage>,
)

data class OutgoingAttachment(
    val type: String,
    val mimeType: String,
    val fileName: String,
    val base64: String,
)

/** Voice conversation entry for the talk-mode transcript. */
data class VoiceConversationEntry(
    val role: String,
    val text: String,
    val timestampMs: Long = System.currentTimeMillis(),
)
