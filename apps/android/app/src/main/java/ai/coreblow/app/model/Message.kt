package ai.coreblow.app.model

import java.util.UUID

/** Chat message model. */
data class Message(
    val id: String = UUID.randomUUID().toString(),
    val conversationId: String,
    val role: String,
    val content: String,
    val toolName: String? = null,
    val toolCallId: String? = null,
    val attachments: List<Attachment> = emptyList(),
    val tokenCount: Int? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isStreaming: Boolean = false,
    val metadata: Map<String, String> = emptyMap(),
)

/** Attachment model for messages. */
data class Attachment(
    val id: String = UUID.randomUUID().toString(),
    val messageId: String? = null,
    val type: String, // "image", "file", "audio", "video"
    val mimeType: String,
    val fileName: String,
    val base64: String = "",
    val uri: String? = null,
    val sizeBytes: Long = 0,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
)

/** Conversation model. */
data class Conversation(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "New Chat",
    val lastMessagePreview: String = "",
    val messageCount: Int = 0,
    val provider: String? = null,
    val model: String? = null,
    val isStarred: Boolean = false,
    val isArchived: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val metadata: Map<String, String> = emptyMap(),
)

/** User session model. */
data class Session(
    val id: String = UUID.randomUUID().toString(),
    val userId: String,
    val gatewayHost: String? = null,
    val gatewayPort: Int? = null,
    val isConnected: Boolean = false,
    val lastActiveMs: Long = System.currentTimeMillis(),
    val tokenUsage: Long = 0,
)

/** User model. */
data class User(
    val id: String = UUID.randomUUID().toString(),
    val displayName: String,
    val email: String? = null,
    val avatarUrl: String? = null,
    val deviceId: String,
    val createdAt: Long = System.currentTimeMillis(),
)

/** Provider configuration model. */
data class Provider(
    val id: String,
    val name: String,
    val type: String, // "openai", "anthropic", "gemini", "local"
    val apiKey: String? = null,
    val baseUrl: String? = null,
    val isEnabled: Boolean = true,
    val models: List<String> = emptyList(),
    val maxTokens: Int = 4096,
    val temperature: Float = 0.7f,
)

/** Preference key-value storage model. */
data class Preference(
    val key: String,
    val value: String,
    val type: String = "string", // "string", "int", "bool", "float"
    val updatedAt: Long = System.currentTimeMillis(),
) {
    fun asInt(default: Int = 0): Int = value.toIntOrNull() ?: default
    fun asBool(default: Boolean = false): Boolean = value.toBooleanStrictOrNull() ?: default
    fun asFloat(default: Float = 0f): Float = value.toFloatOrNull() ?: default
}
