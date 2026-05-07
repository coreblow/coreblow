package ai.coreblow.app.model

import kotlinx.serialization.Serializable

/**
 * Core domain models for the CoreBlow Android app.
 * All models are Serializable for gateway transport and Room persistence.
 */

// ============================================================
// Message — a single chat message
// ============================================================

@Serializable
data class Message(
    val id: String,
    val conversationId: String,
    val role: MessageRole,
    val content: String,
    val toolName: String? = null,
    val toolCallId: String? = null,
    val toolInput: String? = null,
    val attachments: List<Attachment> = emptyList(),
    val tokenCount: Int? = null,
    val model: String? = null,
    val provider: String? = null,
    val finishReason: String? = null,
    val thinkingContent: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val metadata: Map<String, String> = emptyMap(),
) {
    val isUser: Boolean get() = role == MessageRole.USER
    val isAssistant: Boolean get() = role == MessageRole.ASSISTANT
    val isSystem: Boolean get() = role == MessageRole.SYSTEM
    val isTool: Boolean get() = role == MessageRole.TOOL
    val hasAttachments: Boolean get() = attachments.isNotEmpty()
    val hasThinking: Boolean get() = !thinkingContent.isNullOrBlank()
    val displayContent: String get() = content.ifBlank { thinkingContent ?: "" }
    val preview: String get() = content.take(100).replace("\n", " ")
}

@Serializable
enum class MessageRole {
    USER, ASSISTANT, SYSTEM, TOOL,
}

// ============================================================
// Attachment — file/image/media attached to a message
// ============================================================

@Serializable
data class Attachment(
    val id: String = java.util.UUID.randomUUID().toString(),
    val type: AttachmentType,
    val mimeType: String,
    val fileName: String,
    val base64: String = "",
    val uri: String? = null,
    val sizeBytes: Long = 0,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
    val thumbnailBase64: String? = null,
) {
    val isImage: Boolean get() = type == AttachmentType.IMAGE
    val isAudio: Boolean get() = type == AttachmentType.AUDIO
    val isVideo: Boolean get() = type == AttachmentType.VIDEO
    val isDocument: Boolean get() = type == AttachmentType.DOCUMENT
    val sizeDisplay: String get() = when {
        sizeBytes < 1024 -> "${sizeBytes}B"
        sizeBytes < 1024 * 1024 -> "%.1fKB".format(sizeBytes / 1024.0)
        else -> "%.1fMB".format(sizeBytes / (1024.0 * 1024))
    }
}

@Serializable
enum class AttachmentType {
    IMAGE, AUDIO, VIDEO, DOCUMENT, CODE, OTHER,
}

// ============================================================
// Conversation — a chat session
// ============================================================

@Serializable
data class Conversation(
    val id: String = java.util.UUID.randomUUID().toString(),
    val title: String = "New Chat",
    val messages: List<Message> = emptyList(),
    val provider: String? = null,
    val model: String? = null,
    val systemPrompt: String? = null,
    val temperature: Float = 0.7f,
    val maxTokens: Int = 4096,
    val isStarred: Boolean = false,
    val isArchived: Boolean = false,
    val isPinned: Boolean = false,
    val tags: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    val messageCount: Int get() = messages.size
    val lastMessage: Message? get() = messages.lastOrNull()
    val lastMessagePreview: String get() = lastMessage?.preview ?: ""
    val totalTokens: Int get() = messages.mapNotNull { it.tokenCount }.sum()
    val userMessageCount: Int get() = messages.count { it.isUser }
    val assistantMessageCount: Int get() = messages.count { it.isAssistant }
}

// ============================================================
// Session — an active gateway session
// ============================================================

@Serializable
data class Session(
    val id: String,
    val conversationId: String? = null,
    val gatewayHost: String,
    val gatewayPort: Int = 18789,
    val deviceId: String,
    val isConnected: Boolean = false,
    val connectedAt: Long? = null,
    val lastPingMs: Long? = null,
    val latencyMs: Int = 0,
    val capabilities: List<String> = emptyList(),
    val protocolVersion: String = "1.0.0",
    val metadata: Map<String, String> = emptyMap(),
) {
    val isAlive: Boolean get() = isConnected && lastPingMs != null && (System.currentTimeMillis() - (lastPingMs ?: 0)) < 30_000
    val uptimeMs: Long get() = if (connectedAt != null) System.currentTimeMillis() - connectedAt else 0
}

// ============================================================
// User — current app user
// ============================================================

@Serializable
data class User(
    val id: String = "local",
    val displayName: String = "User",
    val email: String? = null,
    val avatarUrl: String? = null,
    val preferences: UserPreferences = UserPreferences(),
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class UserPreferences(
    val theme: String = "system",
    val language: String = "auto",
    val hapticFeedback: Boolean = true,
    val soundEffects: Boolean = true,
    val sendWithEnter: Boolean = true,
    val showTimestamps: Boolean = false,
    val showTokenCount: Boolean = false,
    val compactMode: Boolean = false,
    val fontScale: Float = 1.0f,
    val defaultProvider: String? = null,
    val defaultModel: String? = null,
)

// ============================================================
// Provider — an LLM provider configuration
// ============================================================

@Serializable
data class Provider(
    val id: String,
    val name: String,
    val type: ProviderType,
    val baseUrl: String? = null,
    val apiKey: String? = null,
    val isEnabled: Boolean = true,
    val isDefault: Boolean = false,
    val models: List<ModelInfo> = emptyList(),
    val maxContextTokens: Int = 128_000,
    val supportsStreaming: Boolean = true,
    val supportsVision: Boolean = false,
    val supportsTools: Boolean = true,
) {
    val displayName: String get() = name.ifBlank { type.label }
    val activeModels: List<ModelInfo> get() = models.filter { it.isEnabled }
}

@Serializable
enum class ProviderType(val label: String) {
    OPENAI("OpenAI"),
    ANTHROPIC("Anthropic"),
    GOOGLE("Google"),
    LOCAL("Local"),
    OLLAMA("Ollama"),
    AZURE("Azure"),
    CUSTOM("Custom"),
}

@Serializable
data class ModelInfo(
    val id: String,
    val name: String,
    val contextWindow: Int = 128_000,
    val maxOutputTokens: Int = 4096,
    val inputPricePer1k: Double = 0.0,
    val outputPricePer1k: Double = 0.0,
    val supportsVision: Boolean = false,
    val supportsTools: Boolean = true,
    val isEnabled: Boolean = true,
)

// ============================================================
// Preference — key-value settings
// ============================================================

@Serializable
data class Preference(
    val key: String,
    val value: String,
    val type: PreferenceType = PreferenceType.STRING,
    val updatedAt: Long = System.currentTimeMillis(),
) {
    fun asBoolean(): Boolean = value.toBooleanStrictOrNull() ?: false
    fun asInt(): Int = value.toIntOrNull() ?: 0
    fun asFloat(): Float = value.toFloatOrNull() ?: 0f
    fun asLong(): Long = value.toLongOrNull() ?: 0L
}

@Serializable
enum class PreferenceType {
    STRING, INT, FLOAT, BOOLEAN, LONG, JSON,
}
