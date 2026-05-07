package ai.coreblow.app.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.ui.compose.CoreBlowTheme
import ai.coreblow.app.ui.compose.MobileUiTokens
import ai.coreblow.app.viewmodel.ChatViewModel
import ai.coreblow.app.viewmodel.ConversationViewModel
import kotlinx.coroutines.launch

/**
 * Standalone chat activity for deep-link entry and share targets.
 * Provides a dedicated single-conversation view with immersive UI,
 * drawer navigation, and attachment support.
 */
class ChatActivity : ComponentActivity() {

    companion object {
        private const val TAG = "ChatActivity"
        private const val EXTRA_CONVERSATION_ID = "conversation_id"
        private const val EXTRA_INITIAL_TEXT = "initial_text"
        private const val EXTRA_SHARE_TEXT = "share_text"

        fun launch(context: Context, conversationId: String? = null, initialText: String? = null) {
            val intent = Intent(context, ChatActivity::class.java).apply {
                conversationId?.let { putExtra(EXTRA_CONVERSATION_ID, it) }
                initialText?.let { putExtra(EXTRA_INITIAL_TEXT, it) }
            }
            context.startActivity(intent)
        }
    }

    private val chatViewModel by viewModels<ChatViewModel>()
    private val conversationViewModel by viewModels<ConversationViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID)
        val initialText = intent.getStringExtra(EXTRA_INITIAL_TEXT)
        val shareText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: intent.getStringExtra(EXTRA_SHARE_TEXT)

        Log.i(TAG, "ChatActivity created (conversation=$conversationId, hasInitial=${initialText != null}, hasShare=${shareText != null})")

        // Pre-populate draft if text was shared
        shareText?.let { chatViewModel.updateDraft(it) }
        initialText?.let { chatViewModel.updateDraft(it) }

        setContent {
            CoreBlowTheme {
                ChatActivityContent(
                    chatViewModel = chatViewModel,
                    conversationViewModel = conversationViewModel,
                    conversationId = conversationId,
                    onBack = { finish() },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        text?.let { chatViewModel.updateDraft(it) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatActivityContent(
    chatViewModel: ChatViewModel,
    conversationViewModel: ConversationViewModel,
    conversationId: String?,
    onBack: () -> Unit,
) {
    val messages by chatViewModel.messages.collectAsState()
    val isStreaming by chatViewModel.isStreaming.collectAsState()
    val sessionTitle by chatViewModel.sessionTitle.collectAsState()
    val draft by chatViewModel.draft.collectAsState()
    val canSend by chatViewModel.canSend.collectAsState()
    val error by chatViewModel.errorMessage.collectAsState()
    val tokenUsage by chatViewModel.tokenUsage.collectAsState()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    // Scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(modifier = Modifier.width(280.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Conversations", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    val sessions by conversationViewModel.filteredSessions.collectAsState()
                    sessions.take(20).forEach { session ->
                        NavigationDrawerItem(
                            label = { Text(session.title, maxLines = 1, fontSize = 13.sp) },
                            selected = session.id == conversationId,
                            onClick = {
                                conversationViewModel.switchToSession(session.id)
                                scope.launch { drawerState.close() }
                            },
                            icon = { Icon(if (session.isStarred) Icons.Default.Star else Icons.Default.Chat, null, Modifier.size(16.dp)) },
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    FilledTonalButton(
                        onClick = { conversationViewModel.createNewSession(); scope.launch { drawerState.close() } },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.Add, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("New Chat")
                    }
                }
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(sessionTitle.ifBlank { "Chat" }, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            if (isStreaming) {
                                Text("Generating…", fontSize = 11.sp, color = MobileUiTokens.BrandAccent)
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, "Menu")
                        }
                    },
                    actions = {
                        if (tokenUsage.totalTokens > 0) {
                            Text("${tokenUsage.totalTokens} tok", fontSize = 10.sp, modifier = Modifier.padding(end = 8.dp))
                        }
                        IconButton(onClick = onBack) { Icon(Icons.Default.Close, "Close") }
                    },
                )
            },
        ) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                // Error banner
                AnimatedVisibility(visible = error != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(error ?: "", fontSize = 12.sp, modifier = Modifier.weight(1f))
                            TextButton(onClick = { chatViewModel.clearError() }) { Text("Dismiss", fontSize = 11.sp) }
                        }
                    }
                }

                // Messages area
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    if (messages.isEmpty()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Icon(Icons.Default.Chat, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.outlineVariant)
                            Spacer(Modifier.height(12.dp))
                            Text("Start a conversation", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // Composer
                Surface(tonalElevation = 2.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = { chatViewModel.pickAttachment() }) {
                            Icon(Icons.Default.AttachFile, "Attach")
                        }
                        OutlinedTextField(
                            value = draft,
                            onValueChange = { chatViewModel.updateDraft(it) },
                            placeholder = { Text("Message…", fontSize = 14.sp) },
                            modifier = Modifier.weight(1f),
                            maxLines = 4,
                            singleLine = false,
                        )
                        Spacer(Modifier.width(8.dp))
                        if (isStreaming) {
                            IconButton(onClick = { chatViewModel.abortRun() }) {
                                Icon(Icons.Default.Stop, "Stop", tint = MaterialTheme.colorScheme.error)
                            }
                        } else {
                            IconButton(onClick = { chatViewModel.sendMessage() }, enabled = canSend) {
                                Icon(Icons.Default.Send, "Send", tint = if (canSend) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}
