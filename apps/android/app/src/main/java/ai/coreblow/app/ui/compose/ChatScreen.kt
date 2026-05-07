package ai.coreblow.app.ui.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatRole
import ai.coreblow.app.ui.compose.chat.ChatComposer
import ai.coreblow.app.ui.compose.chat.ChatMarkdown
import ai.coreblow.app.ui.compose.chat.ComposerAttachment
import ai.coreblow.app.viewmodel.ChatViewModel

/**
 * Full chat screen with message list, streaming indicators,
 * tool call display, and composer bar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(viewModel: ChatViewModel) {
    val messages by viewModel.messages.collectAsState()
    val isStreaming by viewModel.isStreaming.collectAsState()
    val healthOk by viewModel.healthOk.collectAsState()
    val pendingRunCount by viewModel.pendingRunCount.collectAsState()
    val sessionTitle by viewModel.sessionTitle.collectAsState()
    val thinkingLevel by viewModel.thinkingLevel.collectAsState()

    val listState = rememberLazyListState()

    // Auto-scroll on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Chat top bar
        TopAppBar(
            title = {
                Column {
                    Text(
                        sessionTitle.ifBlank { "Chat" },
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (isStreaming) {
                        Text("Typing…", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
            },
            actions = {
                IconButton(onClick = { viewModel.clearHistory() }) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = "Clear chat")
                }
            },
        )

        // Message list
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            if (messages.isEmpty()) {
                item {
                    EmptyChatPlaceholder()
                }
            }

            items(messages, key = { it.id }) { message ->
                ChatBubble(message = message, isStreaming = isStreaming && message == messages.lastOrNull())
            }

            // Streaming indicator
            if (isStreaming && (messages.isEmpty() || messages.lastOrNull()?.role != ChatRole.ASSISTANT)) {
                item {
                    StreamingIndicator()
                }
            }
        }

        // Divider
        HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

        // Composer
        ChatComposer(
            onSend = { text, attachments -> viewModel.sendMessage(text, attachments) },
            onAbort = { viewModel.abortRun() },
            onPickAttachment = { viewModel.pickAttachment() },
            healthOk = healthOk,
            pendingRunCount = pendingRunCount,
            thinkingLevel = thinkingLevel,
        )
    }
}

// MARK: - Bubble

@Composable
private fun ChatBubble(message: ChatMessage, isStreaming: Boolean) {
    val isUser = message.role == ChatRole.USER
    val isSystem = message.role == ChatRole.SYSTEM
    val isToolCall = message.role == ChatRole.TOOL

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        if (!isUser && !isSystem) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (isToolCall) Icons.Default.Build else Icons.Default.SmartToy,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Spacer(Modifier.width(8.dp))
        }

        Surface(
            shape = RoundedCornerShape(
                topStart = 16.dp, topEnd = 16.dp,
                bottomStart = if (isUser) 16.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 16.dp,
            ),
            color = when {
                isUser -> MaterialTheme.colorScheme.primaryContainer
                isToolCall -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.6f)
                isSystem -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                else -> MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f)
            },
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                // Tool call header
                if (isToolCall && !message.toolName.isNullOrEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Build, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.tertiary)
                        Spacer(Modifier.width(4.dp))
                        Text(message.toolName, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.tertiary)
                    }
                    Spacer(Modifier.height(4.dp))
                }

                // Message content
                if (message.text.isNotBlank()) {
                    ChatMarkdown(
                        text = message.text,
                        isAssistant = !isUser,
                    )
                }

                // Streaming cursor
                if (isStreaming && !isUser) {
                    AnimatedVisibility(visible = true, enter = fadeIn(), exit = fadeOut()) {
                        Text("▌", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
                    }
                }

                // Timestamp
                if (!isSystem) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = formatTimestamp(message.timestampMs),
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    )
                }
            }
        }

        if (isUser) {
            Spacer(Modifier.width(4.dp))
        }
    }
}

// MARK: - Helpers

@Composable
private fun EmptyChatPlaceholder() {
    Box(
        modifier = Modifier.fillMaxWidth().padding(vertical = 80.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.ChatBubbleOutline,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
            )
            Spacer(Modifier.height(12.dp))
            Text("Start a conversation", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
            Text("Messages appear here", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f))
        }
    }
}

@Composable
private fun StreamingIndicator() {
    Row(
        modifier = Modifier.padding(start = 36.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(8.dp))
        Text("Thinking…", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun formatTimestamp(ms: Long): String {
    if (ms <= 0) return ""
    val date = java.util.Date(ms)
    val fmt = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
    return fmt.format(date)
}
