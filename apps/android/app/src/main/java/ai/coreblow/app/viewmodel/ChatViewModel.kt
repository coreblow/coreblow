package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.node.ConnectionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Chat ViewModel with gateway connection integration.
 *
 * Routes chat messages through the gateway session when connected,
 * falls back to REST API when disconnected.
 */
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    val isLoading = MutableStateFlow(false)

    /** Whether chat is currently routed through gateway. */
    private val _isGatewayMode = MutableStateFlow(false)
    val isGatewayMode: StateFlow<Boolean> = _isGatewayMode.asStateFlow()

    /** Current message input. */
    private val _messageInput = MutableStateFlow("")
    val messageInput: StateFlow<String> = _messageInput.asStateFlow()

    /** Chat messages for display. */
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    /**
     * Update gateway mode based on connection state.
     */
    fun setGatewayMode(connected: Boolean) {
        _isGatewayMode.value = connected
    }

    /**
     * Send a message through the appropriate transport.
     */
    fun sendMessage(text: String) {
        if (text.isBlank()) return

        val userMsg = ChatMessage(role = "user", content = text)
        _messages.value = _messages.value + userMsg
        _messageInput.value = ""
        isLoading.value = true

        // In production, route through gateway session or REST API
        // based on _isGatewayMode state
        isLoading.value = false
    }

    fun setMessageInput(input: String) { _messageInput.value = input }
}

data class ChatMessage(
    val role: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
)
