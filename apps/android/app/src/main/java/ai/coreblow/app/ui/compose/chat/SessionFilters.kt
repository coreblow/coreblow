package ai.coreblow.app.ui.compose.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.ui.compose.MobileUiTokens

/**
 * Session filter controls for filtering chat sessions by type, date, or gateway.
 */
enum class SessionFilter {
    ALL, TODAY, THIS_WEEK, GATEWAY_ONLY, LOCAL_ONLY
}

@Composable
fun SessionFilters(
    selectedFilter: SessionFilter,
    onFilterChanged: (SessionFilter) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = MobileUiTokens.spacingSm),
        horizontalArrangement = Arrangement.spacedBy(MobileUiTokens.spacingXs),
    ) {
        SessionFilter.entries.forEach { filter ->
            FilterChip(
                selected = filter == selectedFilter,
                onClick = { onFilterChanged(filter) },
                label = { Text(filter.label) },
            )
        }
    }
}

private val SessionFilter.label: String
    get() = when (this) {
        SessionFilter.ALL -> "All"
        SessionFilter.TODAY -> "Today"
        SessionFilter.THIS_WEEK -> "This Week"
        SessionFilter.GATEWAY_ONLY -> "Gateway"
        SessionFilter.LOCAL_ONLY -> "Local"
    }
