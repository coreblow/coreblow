package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
)

/**
 * ViewModel for search functionality across chat history,
 * contacts, calendar events, and gateway commands.
 */
class SearchViewModel(application: Application) : AndroidViewModel(application) {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _results = MutableStateFlow<List<SearchResult>>(emptyList())
    val results: StateFlow<List<SearchResult>> = _results.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _selectedFilter = MutableStateFlow("all")
    val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

    private var searchProviders = mutableListOf<SearchProvider>()

    fun registerProvider(provider: SearchProvider) {
        searchProviders.add(provider)
    }

    fun setQuery(q: String) {
        _query.value = q
        if (q.length >= 2) {
            performSearch(q)
        } else {
            _results.value = emptyList()
        }
    }

    fun setFilter(filter: String) {
        _selectedFilter.value = filter
        if (_query.value.length >= 2) performSearch(_query.value)
    }

    fun clearSearch() {
        _query.value = ""
        _results.value = emptyList()
    }

    private fun performSearch(query: String) {
        viewModelScope.launch {
            _isSearching.value = true
            val filter = _selectedFilter.value
            val allResults = mutableListOf<SearchResult>()

            for (provider in searchProviders) {
                if (filter == "all" || provider.type == filter) {
                    try {
                        allResults.addAll(provider.search(query))
                    } catch (_: Throwable) {}
                }
            }

            _results.value = allResults.sortedByDescending { it.score }
            _isSearching.value = false
        }
    }
}

/**
 * Interface for pluggable search providers.
 */
interface SearchProvider {
    val type: String
    suspend fun search(query: String): List<SearchResult>
}
