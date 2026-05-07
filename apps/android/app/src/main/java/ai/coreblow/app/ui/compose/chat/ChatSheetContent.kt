package ai.coreblow.app.ui.compose.chat

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.MainViewModel
import ai.coreblow.app.chat.ChatSessionEntry
import ai.coreblow.app.chat.OutgoingAttachment
import ai.coreblow.app.ui.compose.LocalMobileColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Full chat sheet body — thread selector, error rail, message list,
 * and composer with attachment support.
 */
@Composable
fun ChatSheetContent(viewModel: MainViewModel) {
    val messages by viewModel.chatMessages.collectAsState()
    val errorText by viewModel.chatError.collectAsState()
    val pendingRunCount by viewModel.pendingRunCount.collectAsState()
    val healthOk by viewModel.chatHealthOk.collectAsState()
    val sessionKey by viewModel.chatSessionKey.collectAsState()
    val mainSessionKey by viewModel.mainSessionKey.collectAsState()
    val thinkingLevel by viewModel.chatThinkingLevel.collectAsState()
    val streamingAssistantText by viewModel.chatStreamingAssistantText.collectAsState()
    val pendingToolCalls by viewModel.chatPendingToolCalls.collectAsState()
    val sessions by viewModel.chatSessions.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadChat(mainSessionKey)
    }

    val context = LocalContext.current
    val resolver = context.contentResolver
    val scope = rememberCoroutineScope()
    val colors = LocalMobileColors.current

    val attachments = remember { mutableStateListOf<PendingImageAttachment>() }

    val pickImages = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris ->
        if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult
        scope.launch(Dispatchers.IO) {
            val next = uris.take(8).mapNotNull { uri ->
                try {
                    loadSizedImageAttachment(resolver, uri)
                } catch (_: Throwable) {
                    null
                }
            }
            withContext(Dispatchers.Main) {
                attachments.addAll(next)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Thread selector
        ChatThreadSelector(
            sessionKey = sessionKey,
            sessions = sessions,
            mainSessionKey = mainSessionKey,
            onSelectSession = { key -> viewModel.switchChatSession(key) },
        )

        // Error rail
        if (!errorText.isNullOrBlank()) {
            ChatErrorRail(errorText = errorText!!)
        }

        // Message list
        ChatMessageListCard(
            messages = messages,
            pendingRunCount = pendingRunCount,
            pendingToolCalls = pendingToolCalls,
            streamingAssistantText = streamingAssistantText,
            healthOk = healthOk,
            modifier = Modifier.weight(1f, fill = true),
        )

        // Composer
        Row(modifier = Modifier.fillMaxWidth().imePadding()) {
            ChatComposer(
                healthOk = healthOk,
                thinkingLevel = thinkingLevel,
                pendingRunCount = pendingRunCount,
                attachments = attachments,
                onPickImages = { pickImages.launch("image/*") },
                onRemoveAttachment = { id -> attachments.removeAll { it.id == id } },
                onSetThinkingLevel = { level -> viewModel.setChatThinkingLevel(level) },
                onRefresh = {
                    viewModel.refreshChat()
                    viewModel.refreshChatSessions(limit = 200)
                },
                onAbort = { viewModel.abortChat() },
                onSend = { text ->
                    val outgoing = attachments.map { att ->
                        OutgoingAttachment(
                            type = "image",
                            mimeType = att.mimeType,
                            fileName = att.fileName,
                            base64 = att.base64,
                        )
                    }
                    viewModel.sendChat(
                        message = text,
                        thinking = thinkingLevel,
                        attachments = outgoing,
                    )
                    attachments.clear()
                },
            )
        }
    }
}

// ── Thread selector ─────────────────────────────────────

@Composable
private fun ChatThreadSelector(
    sessionKey: String,
    sessions: List<ChatSessionEntry>,
    mainSessionKey: String,
    onSelectSession: (String) -> Unit,
) {
    val colors = LocalMobileColors.current
    val sessionOptions = remember(sessionKey, sessions, mainSessionKey) {
        resolveSessionChoices(sessionKey, sessions, mainSessionKey = mainSessionKey)
    }

    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        for (entry in sessionOptions) {
            val active = entry.key == sessionKey
            Surface(
                onClick = { onSelectSession(entry.key) },
                shape = RoundedCornerShape(14.dp),
                color = if (active) colors.accent else colors.cardSurface,
                border = BorderStroke(1.dp, if (active) colors.accent else colors.border),
                tonalElevation = 0.dp,
                shadowElevation = 0.dp,
            ) {
                Text(
                    text = friendlySessionName(entry.displayName ?: entry.key),
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    ),
                    color = if (active) Color.White else colors.text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }
}

// ── Error rail ──────────────────────────────────────────

@Composable
private fun ChatErrorRail(errorText: String) {
    val colors = LocalMobileColors.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.danger.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.danger),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                "CHAT ERROR",
                style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 0.6.sp),
                color = colors.danger,
            )
            Text(
                errorText,
                style = MaterialTheme.typography.bodySmall,
                color = colors.text,
            )
        }
    }
}

// ── Pending image model ─────────────────────────────────

data class PendingImageAttachment(
    val id: String,
    val fileName: String,
    val mimeType: String,
    val base64: String,
)
