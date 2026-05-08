package ai.coreblow.app.ui.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionFiltersTest {
    @Test
    fun filterType_allValuesAreDistinct() {
        val values = SessionFilters.FilterType.entries.map { it.name }.toSet()
        assertEquals(SessionFilters.FilterType.entries.size, values.size)
    }

    @Test
    fun defaultFilter_isAll() {
        assertEquals(SessionFilters.FilterType.All, SessionFilters.defaultFilter())
    }

    @Test
    fun matchesFilter_allMatchesEverything() {
        assertTrue(SessionFilters.matches(SessionFilters.FilterType.All, starred = false, archived = false))
        assertTrue(SessionFilters.matches(SessionFilters.FilterType.All, starred = true, archived = true))
    }

    @Test
    fun matchesFilter_starredOnlyMatchesStarred() {
        assertTrue(SessionFilters.matches(SessionFilters.FilterType.Starred, starred = true, archived = false))
        assertFalse(SessionFilters.matches(SessionFilters.FilterType.Starred, starred = false, archived = false))
    }

    @Test
    fun matchesFilter_archivedOnlyMatchesArchived() {
        assertTrue(SessionFilters.matches(SessionFilters.FilterType.Archived, starred = false, archived = true))
        assertFalse(SessionFilters.matches(SessionFilters.FilterType.Archived, starred = false, archived = false))
    }

    @Test
    fun chipLabel_returnsNonEmptyForAllTypes() {
        SessionFilters.FilterType.entries.forEach { filter ->
            val label = SessionFilters.chipLabel(filter)
            assertTrue("Label for $filter should not be empty", label.isNotEmpty())
        }
    }
}
