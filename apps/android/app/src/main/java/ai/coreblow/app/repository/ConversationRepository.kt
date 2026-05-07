package ai.coreblow.app.repository

import android.content.Context
import ai.coreblow.app.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// ============================================================
// ConversationRepository
// ============================================================

class ConversationRepository(private val context: Context) {
    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations.asStateFlow()

    fun getAll(): List<Conversation> = _conversations.value
    fun getById(id: String): Conversation? = _conversations.value.find { it.id == id }

    fun create(title: String = "New Chat"): Conversation {
        val conv = Conversation(title = title)
        _conversations.value = listOf(conv) + _conversations.value
        return conv
    }

    fun update(conversation: Conversation) {
        _conversations.value = _conversations.value.map { if (it.id == conversation.id) conversation else it }
    }

    fun delete(id: String) {
        _conversations.value = _conversations.value.filter { it.id != id }
    }

    fun search(query: String): List<Conversation> {
        return _conversations.value.filter { it.title.contains(query, ignoreCase = true) }
    }
}

// ============================================================
// MessageRepository
// ============================================================

class MessageRepository(private val context: Context) {
    private val messagesByConversation = mutableMapOf<String, MutableList<Message>>()

    fun getMessages(conversationId: String): List<Message> {
        return messagesByConversation[conversationId]?.toList() ?: emptyList()
    }

    fun addMessage(message: Message) {
        val list = messagesByConversation.getOrPut(message.conversationId) { mutableListOf() }
        list.add(message)
    }

    fun updateMessage(message: Message) {
        val list = messagesByConversation[message.conversationId] ?: return
        val idx = list.indexOfFirst { it.id == message.id }
        if (idx >= 0) list[idx] = message
    }

    fun deleteMessage(conversationId: String, messageId: String) {
        messagesByConversation[conversationId]?.removeAll { it.id == messageId }
    }

    fun clearConversation(conversationId: String) {
        messagesByConversation.remove(conversationId)
    }

    fun getMessageCount(conversationId: String): Int = messagesByConversation[conversationId]?.size ?: 0
}

// ============================================================
// ProviderRepository
// ============================================================

class ProviderRepository(private val context: Context) {
    private val _providers = MutableStateFlow<List<Provider>>(emptyList())
    val providers: StateFlow<List<Provider>> = _providers.asStateFlow()

    fun getAll(): List<Provider> = _providers.value
    fun getById(id: String): Provider? = _providers.value.find { it.id == id }
    fun getEnabled(): List<Provider> = _providers.value.filter { it.isEnabled }

    fun addOrUpdate(provider: Provider) {
        val existing = _providers.value.find { it.id == provider.id }
        _providers.value = if (existing != null) {
            _providers.value.map { if (it.id == provider.id) provider else it }
        } else {
            _providers.value + provider
        }
    }

    fun remove(id: String) {
        _providers.value = _providers.value.filter { it.id != id }
    }
}

// ============================================================
// SettingsRepository
// ============================================================

class SettingsRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("coreblow_settings", Context.MODE_PRIVATE)

    fun getString(key: String, default: String = ""): String = prefs.getString(key, default) ?: default
    fun setString(key: String, value: String) = prefs.edit().putString(key, value).apply()
    fun getInt(key: String, default: Int = 0): Int = prefs.getInt(key, default)
    fun setInt(key: String, value: Int) = prefs.edit().putInt(key, value).apply()
    fun getBool(key: String, default: Boolean = false): Boolean = prefs.getBoolean(key, default)
    fun setBool(key: String, value: Boolean) = prefs.edit().putBoolean(key, value).apply()
    fun getFloat(key: String, default: Float = 0f): Float = prefs.getFloat(key, default)
    fun setFloat(key: String, value: Float) = prefs.edit().putFloat(key, value).apply()
    fun remove(key: String) = prefs.edit().remove(key).apply()
    fun clear() = prefs.edit().clear().apply()
    fun getAll(): Map<String, *> = prefs.all
}

// ============================================================
// UserRepository
// ============================================================

class UserRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("coreblow_user", Context.MODE_PRIVATE)

    fun getCurrentUser(): User? {
        val id = prefs.getString("user_id", null) ?: return null
        return User(
            id = id,
            displayName = prefs.getString("display_name", "User") ?: "User",
            email = prefs.getString("email", null),
            deviceId = prefs.getString("device_id", "") ?: "",
        )
    }

    fun saveUser(user: User) {
        prefs.edit()
            .putString("user_id", user.id)
            .putString("display_name", user.displayName)
            .putString("email", user.email)
            .putString("device_id", user.deviceId)
            .apply()
    }

    fun clearUser() = prefs.edit().clear().apply()
    fun isLoggedIn(): Boolean = prefs.getString("user_id", null) != null
}
