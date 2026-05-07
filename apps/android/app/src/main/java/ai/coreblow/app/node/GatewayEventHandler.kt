package ai.coreblow.app.node

import android.util.Log
import ai.coreblow.app.gateway.CoreBlowProtocol
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

/**
 * Central gateway event handler. Routes incoming WebSocket messages
 * to the appropriate handler (invoke, stream, event, auth, ping/pong).
 * Acts as the node-side message dispatcher.
 */
class GatewayEventHandler(
    private val scope: CoroutineScope,
    private val invokeDispatcher: InvokeDispatcher,
) {
    companion object {
        private const val TAG = "GatewayEventHandler"
    }

    // Connection state
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    // Event streams
    private val _events = MutableSharedFlow<GatewayEvent>(replay = 0, extraBufferCapacity = 32)
    val events: SharedFlow<GatewayEvent> = _events.asSharedFlow()

    private val _outgoingMessages = MutableSharedFlow<String>(replay = 0, extraBufferCapacity = 32)
    val outgoingMessages: SharedFlow<String> = _outgoingMessages.asSharedFlow()

    // Metrics
    private var messagesReceived = 0L
    private var messagesSent = 0L
    private var errorsCount = 0L
    private var lastPingMs = 0L
    private var latencyMs = 0

    /**
     * Handle a raw incoming WebSocket text message.
     */
    fun onMessage(raw: String) {
        messagesReceived++
        val parsed = CoreBlowProtocol.parseMessage(raw)
        if (parsed == null) {
            Log.w(TAG, "Unparseable message: ${raw.take(100)}")
            return
        }

        val (type, json) = parsed

        scope.launch(Dispatchers.Default) {
            try {
                when (type) {
                    CoreBlowProtocol.MSG_AUTH_OK -> handleAuthOk(json)
                    CoreBlowProtocol.MSG_AUTH_FAIL -> handleAuthFail(json)
                    CoreBlowProtocol.MSG_INVOKE -> handleInvoke(json)
                    CoreBlowProtocol.MSG_INVOKE_RESULT -> handleInvokeResult(json)
                    CoreBlowProtocol.MSG_INVOKE_ERROR -> handleInvokeError(json)
                    CoreBlowProtocol.MSG_EVENT -> handleEvent(json)
                    CoreBlowProtocol.MSG_PING -> handlePing()
                    CoreBlowProtocol.MSG_PONG -> handlePong(json)
                    CoreBlowProtocol.MSG_STREAM_START -> handleStreamStart(json)
                    CoreBlowProtocol.MSG_STREAM_CHUNK -> handleStreamChunk(json)
                    CoreBlowProtocol.MSG_STREAM_END -> handleStreamEnd(json)
                    CoreBlowProtocol.MSG_STREAM_ERROR -> handleStreamError(json)
                    CoreBlowProtocol.MSG_CAPABILITY_QUERY -> handleCapabilityQuery(json)
                    CoreBlowProtocol.MSG_CLOSE -> handleClose(json)
                    else -> Log.d(TAG, "Unhandled message type: $type")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling $type: ${e.message}")
                errorsCount++
                _lastError.value = e.message
            }
        }
    }

    /**
     * Handle WebSocket connection established.
     */
    fun onConnected() {
        _isConnected.value = true
        _lastError.value = null
        scope.launch { _events.emit(GatewayEvent.Connected) }
        Log.i(TAG, "Gateway connected")
    }

    /**
     * Handle WebSocket connection closed.
     */
    fun onDisconnected(code: Int, reason: String?) {
        _isConnected.value = false
        scope.launch { _events.emit(GatewayEvent.Disconnected(code, reason ?: "unknown")) }
        Log.i(TAG, "Gateway disconnected: $code $reason")
    }

    /**
     * Handle WebSocket error.
     */
    fun onError(error: Throwable) {
        errorsCount++
        _lastError.value = error.message
        scope.launch { _events.emit(GatewayEvent.Error(error.message ?: "Unknown error")) }
        Log.e(TAG, "Gateway error: ${error.message}")
    }

    /**
     * Send a message to the gateway.
     */
    fun send(message: String) {
        messagesSent++
        scope.launch { _outgoingMessages.emit(message) }
    }

    /**
     * Send a ping to measure latency.
     */
    fun sendPing() {
        lastPingMs = System.currentTimeMillis()
        send(CoreBlowProtocol.buildPingMessage())
    }

    /**
     * Get connection metrics.
     */
    fun getMetrics(): GatewayMetrics = GatewayMetrics(
        messagesReceived = messagesReceived,
        messagesSent = messagesSent,
        errorsCount = errorsCount,
        latencyMs = latencyMs,
        isConnected = _isConnected.value,
    )

    // MARK: - Message handlers

    private suspend fun handleAuthOk(json: JsonObject) {
        Log.i(TAG, "Auth OK")
        _events.emit(GatewayEvent.AuthSuccess)
    }

    private suspend fun handleAuthFail(json: JsonObject) {
        val reason = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull ?: "Auth failed"
        Log.w(TAG, "Auth failed: $reason")
        _lastError.value = reason
        _events.emit(GatewayEvent.AuthFailed(reason))
    }

    private suspend fun handleInvoke(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        val namespace = json["namespace"]?.jsonPrimitive?.contentOrNull ?: return
        val command = json["command"]?.jsonPrimitive?.contentOrNull ?: return
        val params = json["params"]?.jsonObject ?: JsonObject(emptyMap())

        Log.d(TAG, "Invoke: $namespace.$command (id=$id)")

        try {
            val result = invokeDispatcher.dispatch(namespace, command, params)
            send(CoreBlowProtocol.buildResultMessage(id, result))
        } catch (e: Exception) {
            Log.e(TAG, "Invoke error: ${e.message}")
            send(CoreBlowProtocol.buildErrorMessage(id, CoreBlowProtocol.ERR_INTERNAL, e.message))
        }
    }

    private suspend fun handleInvokeResult(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        val result = json["result"] ?: JsonNull
        _events.emit(GatewayEvent.InvokeResult(id, result))
    }

    private suspend fun handleInvokeError(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        val errorMsg = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull ?: "Unknown"
        _events.emit(GatewayEvent.InvokeError(id, errorMsg))
    }

    private suspend fun handleEvent(json: JsonObject) {
        val event = json["event"]?.jsonPrimitive?.contentOrNull ?: return
        val data = json["data"]?.jsonObject ?: JsonObject(emptyMap())
        _events.emit(GatewayEvent.RemoteEvent(event, data))
    }

    private fun handlePing() {
        send(CoreBlowProtocol.buildPongMessage())
    }

    private fun handlePong(json: JsonObject) {
        val now = System.currentTimeMillis()
        latencyMs = if (lastPingMs > 0) (now - lastPingMs).toInt() else 0
        Log.d(TAG, "Pong (latency=${latencyMs}ms)")
    }

    private suspend fun handleStreamStart(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        _events.emit(GatewayEvent.StreamStart(id))
    }

    private suspend fun handleStreamChunk(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        val chunk = json["chunk"]?.jsonPrimitive?.contentOrNull ?: ""
        _events.emit(GatewayEvent.StreamChunk(id, chunk))
    }

    private suspend fun handleStreamEnd(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        _events.emit(GatewayEvent.StreamEnd(id))
    }

    private suspend fun handleStreamError(json: JsonObject) {
        val id = json["id"]?.jsonPrimitive?.contentOrNull ?: return
        val error = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull ?: "Stream error"
        _events.emit(GatewayEvent.StreamError(id, error))
    }

    private suspend fun handleCapabilityQuery(json: JsonObject) {
        val capabilities = invokeDispatcher.getCapabilities()
        val response = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_CAPABILITY_RESPONSE)
            put("capabilities", JsonArray(capabilities.map { JsonPrimitive(it) }))
        }
        send(response.toString())
    }

    private suspend fun handleClose(json: JsonObject) {
        val reason = json["reason"]?.jsonPrimitive?.contentOrNull ?: "server requested"
        _events.emit(GatewayEvent.ServerClose(reason))
    }
}

/**
 * Gateway events emitted by the event handler.
 */
sealed class GatewayEvent {
    data object Connected : GatewayEvent()
    data class Disconnected(val code: Int, val reason: String) : GatewayEvent()
    data class Error(val message: String) : GatewayEvent()
    data object AuthSuccess : GatewayEvent()
    data class AuthFailed(val reason: String) : GatewayEvent()
    data class InvokeResult(val id: String, val result: JsonElement) : GatewayEvent()
    data class InvokeError(val id: String, val message: String) : GatewayEvent()
    data class RemoteEvent(val event: String, val data: JsonObject) : GatewayEvent()
    data class StreamStart(val id: String) : GatewayEvent()
    data class StreamChunk(val id: String, val chunk: String) : GatewayEvent()
    data class StreamEnd(val id: String) : GatewayEvent()
    data class StreamError(val id: String, val error: String) : GatewayEvent()
    data class ServerClose(val reason: String) : GatewayEvent()
}

data class GatewayMetrics(
    val messagesReceived: Long,
    val messagesSent: Long,
    val errorsCount: Long,
    val latencyMs: Int,
    val isConnected: Boolean,
)
