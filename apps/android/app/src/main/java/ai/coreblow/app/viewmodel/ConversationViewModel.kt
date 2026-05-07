package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Conversation session data.
 */
data class ConversationSession(
    val id: String,
    val title: String,
    val lastMessageMs: Long,
    val messageCount: Int,
    val isActive: Boolean = false,
)

/**
 * ViewModel for conversation session management (session drawer).
 * Handles listing, creating, switching, renaming, and deleting sessions.
 */
class ConversationViewModel(application: Application) : AndroidViewModel(application) {

    private val _sessions = MutableStateFlow<List<ConversationSession>>(emptyList())
    val sessions: StateFlow<List<ConversationSession>> = _sessions.asStateFlow()

    private val _activeSessionId = MutableStateFlow<String?>(null)
    val activeSessionId: StateFlow<String?> = _activeSessionId.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var onSessionSwitched: ((String) -> Unit)? = null

    fun setOnSessionSwitched(callback: (String) -> Unit) {
        onSessionSwitched = callback
    }

    fun loadSessions(sessionList: List<ConversationSession>) {
        _sessions.value = sessionList.sortedByDescending { it.lastMessageMs }
    }

    fun createNewSession(): String {
        val id = java.util.UUID.randomUUID().toString()
        val session = ConversationSession(
            id = id,
            title = "New Chat",
            lastMessageMs = System.currentTimeMillis(),
            messageCount = 0,
            isActive = true,
        )
        val current = _sessions.value.map { it.copy(isActive = false) }.toMutableList()
        current.add(0, session)
        _sessions.value = current
        _activeSessionId.value = id
        onSessionSwitched?.invoke(id)
        return id
    }

    fun switchToSession(sessionId: String) {
        _sessions.value = _sessions.value.map { it.copy(isActive = it.id == sessionId) }
        _activeSessionId.value = sessionId
        onSessionSwitched?.invoke(sessionId)
    }

    fun renameSession(sessionId: String, newTitle: String) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(title = newTitle.trim()) else it
        }
    }

    fun deleteSession(sessionId: String) {
        _sessions.value = _sessions.value.filter { it.id != sessionId }
        if (_activeSessionId.value == sessionId) {
            val next = _sessions.value.firstOrNull()
            _activeSessionId.value = next?.id
            next?.id?.let { onSessionSwitched?.invoke(it) }
        }
    }

    fun updateSessionMessageCount(sessionId: String, count: Int) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(messageCount = count, lastMessageMs = System.currentTimeMillis()) else it
        }
    }
}
