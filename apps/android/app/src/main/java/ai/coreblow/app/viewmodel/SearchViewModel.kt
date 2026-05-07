package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Search result item.
 */
data class SearchResult(
    val id: String,
    val type: String,
    val title: String,
    val snippet: String,
    val score: Float = 0f,
    val timestampMs: Long = 0,
    val source: String? = null,
    val metadata: Map<String, String> = emptyMap(),
) {
    val displayType: String get() = type.replaceFirstChar { it.uppercase() }
}

/**
 * ViewModel for search functionality across chat history,
 * contacts, calendar events, and gateway commands.
 * Supports debounced search, multiple providers, result
 * grouping, recent searches, and suggestions.
 */
class SearchViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val DEBOUNCE_MS = 300L
        private const val MAX_RECENT_SEARCHES = 20
        private const val MAX_SUGGESTIONS = 5
    }

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _results = MutableStateFlow<List<SearchResult>>(emptyList())
    val results: StateFlow<List<SearchResult>> = _results.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _selectedFilter = MutableStateFlow("all")
    val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

    private val _recentSearches = MutableStateFlow<List<String>>(emptyList())
    val recentSearches: StateFlow<List<String>> = _recentSearches.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var searchProviders = mutableListOf<SearchProvider>()
    private var searchJob: Job? = null

    // Derived state
    val resultCount = _results.map { it.size }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val groupedResults = _results.map { results ->
        results.groupBy { it.type }.mapValues { (_, items) -> items.sortedByDescending { it.score } }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val availableFilters = combine(_results, _selectedFilter) { results, _ ->
        val types = results.map { it.type }.distinct().sorted()
        listOf("all") + types
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), listOf("all"))

    val suggestions = combine(_query, _recentSearches) { query, recent ->
        if (query.isBlank()) {
            recent.take(MAX_SUGGESTIONS)
        } else {
            recent.filter { it.contains(query, ignoreCase = true) }.take(MAX_SUGGESTIONS)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val hasResults = _results.map { it.isNotEmpty() }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun registerProvider(provider: SearchProvider) {
        searchProviders.add(provider)
    }

    fun unregisterProvider(type: String) {
        searchProviders.removeAll { it.type == type }
    }

    fun getRegisteredProviders(): List<String> = searchProviders.map { it.type }

    fun setQuery(q: String) {
        _query.value = q
        _error.value = null
        if (q.length >= 2) {
            debouncedSearch(q)
        } else {
            _results.value = emptyList()
        }
    }

    fun setFilter(filter: String) {
        _selectedFilter.value = filter
        if (_query.value.length >= 2) performSearch(_query.value)
    }

    fun clearSearch() {
        searchJob?.cancel()
        _query.value = ""
        _results.value = emptyList()
        _isSearching.value = false
        _error.value = null
    }

    fun clearError() { _error.value = null }

    fun addToRecentSearches(query: String) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return
        val current = _recentSearches.value.toMutableList()
        current.remove(trimmed) // Deduplicate
        current.add(0, trimmed)
        if (current.size > MAX_RECENT_SEARCHES) current.removeLast()
        _recentSearches.value = current
    }

    fun clearRecentSearches() { _recentSearches.value = emptyList() }

    fun removeRecentSearch(query: String) {
        _recentSearches.value = _recentSearches.value.filter { it != query }
    }

    fun submitSearch() {
        val q = _query.value.trim()
        if (q.length >= 2) {
            addToRecentSearches(q)
            performSearch(q)
        }
    }

    fun selectResult(result: SearchResult) {
        // Tracked for analytics
        addToRecentSearches(_query.value)
    }

    private fun debouncedSearch(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(DEBOUNCE_MS)
            performSearch(query)
        }
    }

    private fun performSearch(query: String) {
        viewModelScope.launch {
            _isSearching.value = true
            _error.value = null
            val filter = _selectedFilter.value
            val allResults = mutableListOf<SearchResult>()
            var errorMessages = mutableListOf<String>()

            for (provider in searchProviders) {
                if (filter == "all" || provider.type == filter) {
                    try {
                        val providerResults = provider.search(query)
                        allResults.addAll(providerResults.map { it.copy(source = provider.type) })
                    } catch (e: Throwable) {
                        errorMessages.add("${provider.type}: ${e.message}")
                    }
                }
            }

            _results.value = allResults.sortedByDescending { it.score }
            if (errorMessages.isNotEmpty()) {
                _error.value = "Some providers failed: ${errorMessages.joinToString("; ")}"
            }
            _isSearching.value = false
        }
    }
}

/**
 * Interface for pluggable search providers.
 */
interface SearchProvider {
    val type: String
    val displayName: String get() = type.replaceFirstChar { it.uppercase() }
    suspend fun search(query: String): List<SearchResult>
    suspend fun suggest(query: String): List<String> = emptyList()
}

/**
 * Built-in conversation search provider.
 */
class ConversationSearchProvider(private val getConversations: () -> List<ConversationSession>) : SearchProvider {
    override val type = "conversation"
    override val displayName = "Conversations"

    override suspend fun search(query: String): List<SearchResult> {
        return getConversations()
            .filter { it.title.contains(query, ignoreCase = true) || it.lastMessagePreview.contains(query, ignoreCase = true) }
            .map { session ->
                SearchResult(
                    id = session.id,
                    type = type,
                    title = session.title,
                    snippet = session.lastMessagePreview.take(100),
                    score = if (session.title.contains(query, ignoreCase = true)) 1.0f else 0.5f,
                    timestampMs = session.lastMessageMs,
                )
            }
    }
}
