package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.chat.ChatController
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatRole
import ai.coreblow.app.ui.compose.chat.ComposerAttachment
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
 * ViewModel for the Chat tab. Bridges ChatController state
 * to Compose UI and handles user actions (send, abort, clear, attachments).
 */
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private var chatController: ChatController? = null

    // Core state
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isStreaming = MutableStateFlow(false)
    val isStreaming: StateFlow<Boolean> = _isStreaming.asStateFlow()

    private val _healthOk = MutableStateFlow(false)
    val healthOk: StateFlow<Boolean> = _healthOk.asStateFlow()

    private val _pendingRunCount = MutableStateFlow(0)
    val pendingRunCount: StateFlow<Int> = _pendingRunCount.asStateFlow()

    private val _sessionTitle = MutableStateFlow("")
    val sessionTitle: StateFlow<String> = _sessionTitle.asStateFlow()

    private val _thinkingLevel = MutableStateFlow("normal")
    val thinkingLevel: StateFlow<String> = _thinkingLevel.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Extended state
    private val _draft = MutableStateFlow("")
    val draft: StateFlow<String> = _draft.asStateFlow()

    private val _pendingAttachments = MutableStateFlow<List<ComposerAttachment>>(emptyList())
    val pendingAttachments: StateFlow<List<ComposerAttachment>> = _pendingAttachments.asStateFlow()

    private val _isTyping = MutableStateFlow(false)
    val isTyping: StateFlow<Boolean> = _isTyping.asStateFlow()

    private val _tokenUsage = MutableStateFlow(TokenUsage(0, 0, 0))
    val tokenUsage: StateFlow<TokenUsage> = _tokenUsage.asStateFlow()

    private val _model = MutableStateFlow<String?>(null)
    val model: StateFlow<String?> = _model.asStateFlow()

    private val _provider = MutableStateFlow<String?>(null)
    val provider: StateFlow<String?> = _provider.asStateFlow()

    private val _scrollToBottom = MutableStateFlow(0L)
    val scrollToBottom: StateFlow<Long> = _scrollToBottom.asStateFlow()

    private var typingJob: Job? = null
    private var autoSaveJob: Job? = null

    // Derived state
    val messageCount = _messages.map { it.size }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
    val hasMessages = _messages.map { it.isNotEmpty() }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val lastMessage = _messages.map { it.lastOrNull() }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val canSend = combine(_draft, _isStreaming, _pendingAttachments) { draft, streaming, attachments ->
        (draft.isNotBlank() || attachments.isNotEmpty()) && !streaming
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun bindController(controller: ChatController) {
        chatController = controller
        viewModelScope.launch {
            controller.messages.collect { _messages.value = it }
        }
        viewModelScope.launch {
            controller.isStreaming.collect { _isStreaming.value = it }
        }
        viewModelScope.launch {
            controller.pendingRunCount.collect { _pendingRunCount.value = it }
        }
    }

    fun setHealthOk(ok: Boolean) { _healthOk.value = ok }
    fun setSessionTitle(title: String) { _sessionTitle.value = title }
    fun setThinkingLevel(level: String) { _thinkingLevel.value = level }
    fun setModel(model: String?) { _model.value = model }
    fun setProvider(provider: String?) { _provider.value = provider }

    fun updateDraft(text: String) {
        _draft.value = text
        // Simulate typing indicator
        typingJob?.cancel()
        if (text.isNotEmpty()) {
            _isTyping.value = true
            typingJob = viewModelScope.launch {
                delay(2000)
                _isTyping.value = false
            }
        } else {
            _isTyping.value = false
        }
    }

    fun sendMessage(text: String? = null, attachments: List<ComposerAttachment>? = null) {
        val messageText = text ?: _draft.value
        val messageAttachments = attachments ?: _pendingAttachments.value

        if (messageText.isBlank() && messageAttachments.isEmpty()) return
        val controller = chatController ?: return

        viewModelScope.launch {
            try {
                _errorMessage.value = null
                controller.sendMessage(messageText, messageAttachments.map { att ->
                    mapOf(
                        "type" to att.type,
                        "mimeType" to att.mimeType,
                        "fileName" to att.fileName,
                        "base64" to att.base64,
                    )
                })
                // Clear draft and attachments after send
                _draft.value = ""
                _pendingAttachments.value = emptyList()
                _scrollToBottom.value = System.currentTimeMillis()

                // Update token usage
                _tokenUsage.value = _tokenUsage.value.copy(
                    messagesSent = _tokenUsage.value.messagesSent + 1,
                )
            } catch (e: Throwable) {
                _errorMessage.value = e.message ?: "Send failed"
            }
        }
    }

    fun addAttachment(attachment: ComposerAttachment) {
        _pendingAttachments.value = _pendingAttachments.value + attachment
    }

    fun removeAttachment(index: Int) {
        val current = _pendingAttachments.value.toMutableList()
        if (index in current.indices) {
            current.removeAt(index)
            _pendingAttachments.value = current
        }
    }

    fun clearAttachments() {
        _pendingAttachments.value = emptyList()
    }

    fun abortRun() {
        viewModelScope.launch {
            chatController?.abortCurrentRun()
        }
    }

    fun clearHistory() {
        chatController?.clearHistory()
        _messages.value = emptyList()
        _tokenUsage.value = TokenUsage(0, 0, 0)
    }

    fun pickAttachment() {
        // Trigger system file picker — handled by Activity
    }

    fun retryLastMessage() {
        val msgs = _messages.value
        val lastUserMsg = msgs.lastOrNull { it.role == ChatRole.USER }
        if (lastUserMsg != null) {
            sendMessage(lastUserMsg.text)
        }
    }

    fun editMessage(messageId: String, newText: String) {
        val msgs = _messages.value.toMutableList()
        val idx = msgs.indexOfFirst { it.id == messageId }
        if (idx >= 0) {
            msgs[idx] = msgs[idx].copy(text = newText)
            _messages.value = msgs
            // Remove all messages after the edited one and resend
            _messages.value = msgs.take(idx + 1)
            sendMessage(newText)
        }
    }

    fun deleteMessage(messageId: String) {
        _messages.value = _messages.value.filter { it.id != messageId }
    }

    fun clearError() { _errorMessage.value = null }

    fun requestScrollToBottom() { _scrollToBottom.value = System.currentTimeMillis() }

    fun updateTokenUsage(input: Int, output: Int) {
        _tokenUsage.value = _tokenUsage.value.copy(
            inputTokens = _tokenUsage.value.inputTokens + input,
            outputTokens = _tokenUsage.value.outputTokens + output,
        )
    }

    data class TokenUsage(
        val inputTokens: Int,
        val outputTokens: Int,
        val messagesSent: Int,
    ) {
        val totalTokens: Int get() = inputTokens + outputTokens
    }
}
