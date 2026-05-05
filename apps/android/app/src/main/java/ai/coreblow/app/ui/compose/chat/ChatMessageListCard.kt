package ai.coreblow.app.ui.compose.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.ui.compose.MobileUiTokens
import ai.coreblow.app.viewmodel.ChatMessage
import ai.coreblow.app.viewmodel.ChatViewModel

/**
 * Chat message list displaying user and assistant messages as cards.
 */
@Composable
fun ChatMessageListCard(chatViewModel: ChatViewModel) {
    val messages by chatViewModel.messages.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = MobileUiTokens.spacingSm),
        verticalArrangement = Arrangement.spacedBy(MobileUiTokens.spacingSm),
        reverseLayout = true,
    ) {
        items(messages.reversed()) { message ->
            MessageCard(message)
        }
    }
}

@Composable
private fun MessageCard(message: ChatMessage) {
    val isUser = message.role == "user"
    val containerColor = if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (isUser) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
    val alignment = if (isUser) Arrangement.End else Arrangement.Start

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = alignment) {
        Card(
            colors = CardDefaults.cardColors(containerColor = containerColor),
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(text = message.content, color = contentColor, style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(4.dp))
                Text(
                    text = formatTimestamp(message.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = contentColor.copy(alpha = 0.6f),
                )
            }
        }
    }
}

private fun formatTimestamp(ts: Long): String {
    val formatter = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
    return formatter.format(java.util.Date(ts))
}
