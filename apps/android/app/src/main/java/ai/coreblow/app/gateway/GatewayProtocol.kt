package ai.coreblow.app.gateway

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.*

/**
 * Manages the WebSocket connection lifecycle to the gateway.
 * Handles connection, authentication, keepalive, and reconnection.
 */
class GatewayProtocol(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    companion object {
        private const val TAG = "GatewayProtocol"
        private const val KEEPALIVE_INTERVAL_MS = 25_000L
        private const val AUTH_TIMEOUT_MS = 10_000L
        private const val MAX_MESSAGE_SIZE = 5 * 1024 * 1024 // 5MB
    }

    private val _state = MutableStateFlow(ProtocolState.IDLE)
    val state: StateFlow<ProtocolState> = _state.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _serverInfo = MutableStateFlow<ServerInfo?>(null)
    val serverInfo: StateFlow<ServerInfo?> = _serverInfo.asStateFlow()

    private var keepaliveJob: Job? = null
    private var authTimeoutJob: Job? = null
    private var onSend: ((String) -> Unit)? = null

    // Message sequence tracking
    private var messageSeq = 0L
    private val pendingRequests = mutableMapOf<String, CompletableDeferred<JsonElement>>()

    /**
     * Set the send callback for outgoing messages.
     */
    fun setSendCallback(callback: (String) -> Unit) {
        onSend = callback
    }

    /**
     * Initiate protocol handshake after WebSocket connects.
     */
    fun onConnected() {
        _state.value = ProtocolState.AUTHENTICATING
        startAuthTimeout()
        sendHello()
        Log.i(TAG, "Protocol handshake started")
    }

    /**
     * Handle disconnection.
     */
    fun onDisconnected() {
        _state.value = ProtocolState.DISCONNECTED
        _isAuthenticated.value = false
        keepaliveJob?.cancel()
        authTimeoutJob?.cancel()
        cancelAllPending("Disconnected")
        Log.i(TAG, "Protocol disconnected")
    }

    /**
     * Process an incoming protocol message.
     */
    fun handleMessage(type: String, json: JsonObject) {
        when (type) {
            CoreBlowProtocol.MSG_AUTH_OK -> {
                authTimeoutJob?.cancel()
                _isAuthenticated.value = true
                _state.value = ProtocolState.READY
                parseServerInfo(json)
                startKeepalive()
                Log.i(TAG, "Authenticated successfully")
            }
            CoreBlowProtocol.MSG_AUTH_FAIL -> {
                authTimeoutJob?.cancel()
                _state.value = ProtocolState.AUTH_FAILED
                _isAuthenticated.value = false
                val reason = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull ?: "Unknown"
                Log.w(TAG, "Auth failed: $reason")
            }
            CoreBlowProtocol.MSG_PONG -> {
                // Keepalive confirmed
            }
            CoreBlowProtocol.MSG_INVOKE_RESULT -> {
                val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
                pendingRequests.remove(id)?.complete(json["result"] ?: JsonNull)
            }
            CoreBlowProtocol.MSG_INVOKE_ERROR -> {
                val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
                val msg = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull ?: "Error"
                pendingRequests.remove(id)?.completeExceptionally(Exception(msg))
            }
            CoreBlowProtocol.MSG_CLOSE -> {
                _state.value = ProtocolState.CLOSING
                Log.i(TAG, "Server requested close")
            }
        }
    }

    /**
     * Send an invoke request and await the result.
     */
    suspend fun invoke(namespace: String, command: String, params: JsonObject = JsonObject(emptyMap()), timeoutMs: Long = 30_000L): JsonElement {
        if (_state.value != ProtocolState.READY) throw IllegalStateException("Not connected (state=${_state.value})")

        val id = generateRequestId()
        val deferred = CompletableDeferred<JsonElement>()
        pendingRequests[id] = deferred

        val message = CoreBlowProtocol.buildInvokeMessage(id, namespace, command, params)
        send(message)

        return withTimeout(timeoutMs) {
            try {
                deferred.await()
            } finally {
                pendingRequests.remove(id)
            }
        }
    }

    /**
     * Send an event to the gateway.
     */
    fun sendEvent(event: String, data: JsonObject = JsonObject(emptyMap())) {
        send(CoreBlowProtocol.buildEventMessage(event, data))
    }

    /**
     * Gracefully close the connection.
     */
    fun close(reason: String = "client_close") {
        _state.value = ProtocolState.CLOSING
        keepaliveJob?.cancel()
        send(buildJsonObject {
            put("type", CoreBlowProtocol.MSG_CLOSE)
            put("reason", reason)
        }.toString())
    }

    /**
     * Get count of pending requests.
     */
    fun getPendingCount(): Int = pendingRequests.size

    // MARK: - Private

    private fun sendHello() {
        val hello = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_HELLO)
            put("role", CoreBlowProtocol.ROLE_NODE)
            put("protocolVersion", CoreBlowProtocol.PROTOCOL_VERSION)
            put("platform", "android")
            put("sdkVersion", android.os.Build.VERSION.SDK_INT)
            put("device", android.os.Build.MODEL)
            put("timestampMs", System.currentTimeMillis())
        }
        send(hello.toString())
    }

    private fun startKeepalive() {
        keepaliveJob?.cancel()
        keepaliveJob = scope.launch {
            while (isActive) {
                delay(KEEPALIVE_INTERVAL_MS)
                if (_state.value == ProtocolState.READY) {
                    send(CoreBlowProtocol.buildPingMessage())
                }
            }
        }
    }

    private fun startAuthTimeout() {
        authTimeoutJob?.cancel()
        authTimeoutJob = scope.launch {
            delay(AUTH_TIMEOUT_MS)
            if (!_isAuthenticated.value) {
                _state.value = ProtocolState.AUTH_FAILED
                Log.w(TAG, "Auth timeout after ${AUTH_TIMEOUT_MS}ms")
            }
        }
    }

    private fun cancelAllPending(reason: String) {
        pendingRequests.forEach { (_, deferred) ->
            deferred.completeExceptionally(Exception(reason))
        }
        pendingRequests.clear()
    }

    private fun parseServerInfo(json: JsonObject) {
        _serverInfo.value = ServerInfo(
            version = json["version"]?.jsonPrimitive?.contentOrNull ?: "unknown",
            name = json["name"]?.jsonPrimitive?.contentOrNull ?: "Gateway",
            capabilities = json["capabilities"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
        )
    }

    private fun generateRequestId(): String = "req_${++messageSeq}_${System.currentTimeMillis()}"

    private fun send(message: String) {
        if (message.length > MAX_MESSAGE_SIZE) {
            Log.w(TAG, "Message too large: ${message.length} bytes")
            return
        }
        onSend?.invoke(message)
    }
}

enum class ProtocolState {
    IDLE, AUTHENTICATING, READY, AUTH_FAILED, CLOSING, DISCONNECTED,
}

data class ServerInfo(
    val version: String,
    val name: String,
    val capabilities: List<String>,
)
