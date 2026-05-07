package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
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
    val isStarred: Boolean = false,
    val isArchived: Boolean = false,
    val provider: String? = null,
    val model: String? = null,
    val lastMessagePreview: String = "",
    val tokenCount: Int = 0,
)

/**
 * ViewModel for conversation session management (session drawer).
 * Handles listing, creating, switching, renaming, deleting,
 * starring, archiving, searching, and exporting sessions.
 */
class ConversationViewModel(application: Application) : AndroidViewModel(application) {

    private val _sessions = MutableStateFlow<List<ConversationSession>>(emptyList())
    val sessions: StateFlow<List<ConversationSession>> = _sessions.asStateFlow()

    private val _activeSessionId = MutableStateFlow<String?>(null)
    val activeSessionId: StateFlow<String?> = _activeSessionId.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _filter = MutableStateFlow(SessionFilter.ALL)
    val filter: StateFlow<SessionFilter> = _filter.asStateFlow()

    private val _sortOrder = MutableStateFlow(SortOrder.RECENT)
    val sortOrder: StateFlow<SortOrder> = _sortOrder.asStateFlow()

    private var onSessionSwitched: ((String) -> Unit)? = null

    // Derived state
    val filteredSessions = combine(_sessions, _searchQuery, _filter, _sortOrder) { sessions, query, filter, sort ->
        var result = sessions

        // Apply filter
        result = when (filter) {
            SessionFilter.ALL -> result.filter { !it.isArchived }
            SessionFilter.STARRED -> result.filter { it.isStarred && !it.isArchived }
            SessionFilter.ARCHIVED -> result.filter { it.isArchived }
        }

        // Apply search
        if (query.isNotBlank()) {
            result = result.filter {
                it.title.contains(query, ignoreCase = true) ||
                it.lastMessagePreview.contains(query, ignoreCase = true)
            }
        }

        // Apply sort
        result = when (sort) {
            SortOrder.RECENT -> result.sortedByDescending { it.lastMessageMs }
            SortOrder.OLDEST -> result.sortedBy { it.lastMessageMs }
            SortOrder.ALPHABETICAL -> result.sortedBy { it.title.lowercase() }
            SortOrder.MESSAGE_COUNT -> result.sortedByDescending { it.messageCount }
        }

        result
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val activeSession = combine(_sessions, _activeSessionId) { sessions, id ->
        sessions.find { it.id == id }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val sessionCount = _sessions.map { it.size }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
    val starredCount = _sessions.map { s -> s.count { it.isStarred } }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    fun setOnSessionSwitched(callback: (String) -> Unit) { onSessionSwitched = callback }

    fun loadSessions(sessionList: List<ConversationSession>) {
        _sessions.value = sessionList.sortedByDescending { it.lastMessageMs }
    }

    fun setSearchQuery(query: String) { _searchQuery.value = query }
    fun setFilter(filter: SessionFilter) { _filter.value = filter }
    fun setSortOrder(order: SortOrder) { _sortOrder.value = order }

    fun createNewSession(title: String = "New Chat", provider: String? = null, model: String? = null): String {
        val id = java.util.UUID.randomUUID().toString()
        val session = ConversationSession(
            id = id,
            title = title,
            lastMessageMs = System.currentTimeMillis(),
            messageCount = 0,
            isActive = true,
            provider = provider,
            model = model,
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
            val next = _sessions.value.firstOrNull { !it.isArchived }
            _activeSessionId.value = next?.id
            next?.id?.let { onSessionSwitched?.invoke(it) }
        }
    }

    fun toggleStarred(sessionId: String) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(isStarred = !it.isStarred) else it
        }
    }

    fun archiveSession(sessionId: String) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(isArchived = true) else it
        }
        if (_activeSessionId.value == sessionId) {
            val next = _sessions.value.firstOrNull { !it.isArchived }
            _activeSessionId.value = next?.id
            next?.id?.let { onSessionSwitched?.invoke(it) }
        }
    }

    fun unarchiveSession(sessionId: String) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(isArchived = false) else it
        }
    }

    fun duplicateSession(sessionId: String): String? {
        val source = _sessions.value.find { it.id == sessionId } ?: return null
        val newId = java.util.UUID.randomUUID().toString()
        val copy = source.copy(
            id = newId,
            title = "${source.title} (copy)",
            lastMessageMs = System.currentTimeMillis(),
            isActive = false,
            isStarred = false,
        )
        _sessions.value = listOf(copy) + _sessions.value
        return newId
    }

    fun updateSessionMessageCount(sessionId: String, count: Int) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(messageCount = count, lastMessageMs = System.currentTimeMillis()) else it
        }
    }

    fun updateSessionPreview(sessionId: String, preview: String) {
        _sessions.value = _sessions.value.map {
            if (it.id == sessionId) it.copy(lastMessagePreview = preview) else it
        }
    }

    fun deleteAllArchived() {
        _sessions.value = _sessions.value.filter { !it.isArchived }
    }

    fun exportSession(sessionId: String): String? {
        val session = _sessions.value.find { it.id == sessionId } ?: return null
        return """
            |# ${session.title}
            |Created: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault()).format(java.util.Date(session.lastMessageMs))}
            |Messages: ${session.messageCount}
            |Provider: ${session.provider ?: "N/A"}
            |Model: ${session.model ?: "N/A"}
        """.trimMargin()
    }

    enum class SessionFilter { ALL, STARRED, ARCHIVED }
    enum class SortOrder { RECENT, OLDEST, ALPHABETICAL, MESSAGE_COUNT }
}
