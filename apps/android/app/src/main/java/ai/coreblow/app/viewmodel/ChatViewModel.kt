package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.chat.ChatController
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatRole
import ai.coreblow.app.ui.compose.chat.ComposerAttachment
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel for the Chat tab. Bridges ChatController state
 * to Compose UI and handles user actions (send, abort, clear, attachments).
 */
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private var chatController: ChatController? = null

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

    fun setHealthOk(ok: Boolean) {
        _healthOk.value = ok
    }

    fun setSessionTitle(title: String) {
        _sessionTitle.value = title
    }

    fun setThinkingLevel(level: String) {
        _thinkingLevel.value = level
    }

    fun sendMessage(text: String, attachments: List<ComposerAttachment> = emptyList()) {
        if (text.isBlank() && attachments.isEmpty()) return
        val controller = chatController ?: return

        viewModelScope.launch {
            try {
                _errorMessage.value = null
                controller.sendMessage(text, attachments.map { att ->
                    mapOf(
                        "type" to att.type,
                        "mimeType" to att.mimeType,
                        "fileName" to att.fileName,
                        "base64" to att.base64,
                    )
                })
            } catch (e: Throwable) {
                _errorMessage.value = e.message ?: "Send failed"
            }
        }
    }

    fun abortRun() {
        viewModelScope.launch {
            chatController?.abortCurrentRun()
        }
    }

    fun clearHistory() {
        chatController?.clearHistory()
        _messages.value = emptyList()
    }

    fun pickAttachment() {
        // Trigger system file picker - handled by Activity
    }

    fun retryLastMessage() {
        val msgs = _messages.value
        val lastUserMsg = msgs.lastOrNull { it.role == ChatRole.USER }
        if (lastUserMsg != null) {
            sendMessage(lastUserMsg.text)
        }
    }

    fun clearError() {
        _errorMessage.value = null
    }
}
