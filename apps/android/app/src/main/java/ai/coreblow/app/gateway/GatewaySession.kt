package ai.coreblow.app.gateway

import android.os.Build
import android.util.Log
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * Client identity sent during the handshake.
 */
data class GatewayClientInfo(
    val id: String,
    val displayName: String?,
    val version: String,
    val platform: String,
    val mode: String,
    val instanceId: String?,
    val deviceFamily: String?,
    val modelIdentifier: String?,
)

/**
 * Options for establishing a gateway connection.
 */
data class GatewayConnectOptions(
    val role: String,
    val scopes: List<String>,
    val capabilities: List<String>,
    val commands: List<String>,
    val permissions: Map<String, Boolean>,
    val client: GatewayClientInfo,
)

/**
 * Connection state exposed to the UI layer.
 */
enum class GatewayConnectionState {
    DISCONNECTED,
    CONNECTING,
    AUTHENTICATING,
    CONNECTED,
    RECONNECTING,
}

/**
 * Listener for gateway session events.
 */
interface GatewaySessionListener {
    fun onStateChanged(state: GatewayConnectionState)
    fun onInvokeRequest(requestId: String, command: String, params: JsonObject)
    fun onEvent(eventType: String, payload: JsonObject)
    fun onError(error: InvokeError)
}

/**
 * Manages a WebSocket connection to a CoreBlow gateway.
 *
 * Handles the full lifecycle: connect → hello → auth → invoke/result → reconnect.
 */
class GatewaySession(
    private val scope: CoroutineScope,
    private val listener: GatewaySessionListener,
) {
    companion object {
        private const val TAG = "GatewaySession"
        private const val PING_INTERVAL_MS = 25_000L
        private const val RECONNECT_BASE_MS = 1_000L
        private const val RECONNECT_MAX_MS = 30_000L
        private const val INVOKE_TIMEOUT_MS = 30_000L
        private const val CONNECT_TIMEOUT_SEC = 15L
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val connected = AtomicBoolean(false)
    private val shouldReconnect = AtomicBoolean(false)
    private val pendingResults = ConcurrentHashMap<String, CompletableDeferred<JsonElement>>()

    private var webSocket: WebSocket? = null
    private var pingJob: Job? = null
    private var reconnectAttempt = 0

    private var currentEndpoint: GatewayEndpoint? = null
    private var currentOptions: GatewayConnectOptions? = null
    private var authToken: String? = null

    val isConnected: Boolean get() = connected.get()

    /**
     * Connect to the given gateway endpoint.
     */
    fun connect(
        endpoint: GatewayEndpoint,
        options: GatewayConnectOptions,
        token: String?,
    ) {
        currentEndpoint = endpoint
        currentOptions = options
        authToken = token
        shouldReconnect.set(true)
        reconnectAttempt = 0

        doConnect(endpoint, options)
    }

    /**
     * Disconnect and stop reconnecting.
     */
    fun disconnect() {
        shouldReconnect.set(false)
        connected.set(false)
        pingJob?.cancel()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        pendingResults.values.forEach { it.cancel() }
        pendingResults.clear()
        listener.onStateChanged(GatewayConnectionState.DISCONNECTED)
    }

    /**
     * Send an invoke result back to the gateway.
     */
    fun sendResult(requestId: String, result: JsonElement) {
        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_RESULT)
            put("id", requestId)
            put("result", result)
        }
        send(msg)
    }

    /**
     * Send an invoke error back to the gateway.
     */
    fun sendError(requestId: String, error: InvokeError) {
        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_ERROR)
            put("id", requestId)
            putJsonObject("error") {
                put("code", error.code)
                put("message", error.message)
                error.detail?.let { put("detail", it) }
            }
        }
        send(msg)
    }

    // -- Private --

    private fun doConnect(endpoint: GatewayEndpoint, options: GatewayConnectOptions) {
        listener.onStateChanged(GatewayConnectionState.CONNECTING)

        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_SEC, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(PING_INTERVAL_MS, TimeUnit.MILLISECONDS)

        val tlsParams = if (endpoint.useTls) GatewayTlsParams(required = true, fingerprint = null) else null
        GatewayTls.configureClient(clientBuilder, tlsParams)

        val client = clientBuilder.build()
        val request = Request.Builder().url(endpoint.wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket opened to ${endpoint.label}")
                connected.set(true)
                reconnectAttempt = 0
                sendHello(options)
                startPingLoop()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closing: $code $reason")
                webSocket.close(code, reason)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $code $reason")
                onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}")
                onDisconnected()
            }
        })
    }

    private fun sendHello(options: GatewayConnectOptions) {
        listener.onStateChanged(GatewayConnectionState.AUTHENTICATING)

        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_HELLO)
            put("version", CoreBlowProtocol.PROTOCOL_VERSION)
            put("role", options.role)
            putJsonArray("scopes") { options.scopes.forEach { add(JsonPrimitive(it)) } }
            putJsonArray("caps") { options.capabilities.forEach { add(JsonPrimitive(it)) } }
            putJsonArray("commands") { options.commands.forEach { add(JsonPrimitive(it)) } }
            putJsonObject("client") {
                put("id", options.client.id)
                options.client.displayName?.let { put("displayName", it) }
                put("version", options.client.version)
                put("platform", options.client.platform)
                put("mode", options.client.mode)
                options.client.instanceId?.let { put("instanceId", it) }
                options.client.deviceFamily?.let { put("deviceFamily", it) }
                options.client.modelIdentifier?.let { put("modelIdentifier", it) }
            }
            authToken?.let {
                putJsonObject("auth") {
                    put("type", CoreBlowProtocol.AUTH_DEVICE_TOKEN)
                    put("token", it)
                }
            }
        }
        send(msg)
    }

    private fun handleMessage(text: String) {
        val obj = try {
            json.parseToJsonElement(text) as? JsonObject ?: return
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message: ${e.message}")
            return
        }

        val type = obj["type"]?.let {
            (it as? JsonPrimitive)?.content
        } ?: return

        when (type) {
            CoreBlowProtocol.MSG_AUTH_RESULT -> handleAuthResult(obj)
            CoreBlowProtocol.MSG_INVOKE -> handleInvoke(obj)
            CoreBlowProtocol.MSG_RESULT -> handleResult(obj)
            CoreBlowProtocol.MSG_ERROR -> handleError(obj)
            CoreBlowProtocol.MSG_EVENT -> handleEvent(obj)
            CoreBlowProtocol.MSG_PONG -> { /* heartbeat ack */ }
            CoreBlowProtocol.MSG_BYE -> disconnect()
            else -> Log.w(TAG, "Unknown message type: $type")
        }
    }

    private fun handleAuthResult(obj: JsonObject) {
        val success = (obj["success"] as? JsonPrimitive)?.content?.toBoolean() ?: false
        if (success) {
            Log.i(TAG, "Authentication successful")
            listener.onStateChanged(GatewayConnectionState.CONNECTED)
        } else {
            val error = InvokeErrorParser.parse(obj["error"])
            Log.e(TAG, "Authentication failed: ${error.message}")
            listener.onError(error)
            disconnect()
        }
    }

    private fun handleInvoke(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content ?: UUID.randomUUID().toString()
        val command = (obj["command"] as? JsonPrimitive)?.content ?: return
        val params = obj["params"] as? JsonObject ?: JsonObject(emptyMap())

        listener.onInvokeRequest(requestId, command, params)
    }

    private fun handleResult(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content ?: return
        val result = obj["result"] ?: JsonNull
        pendingResults.remove(requestId)?.complete(result)
    }

    private fun handleError(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content
        if (requestId != null) {
            val error = InvokeErrorParser.parse(obj["error"])
            pendingResults.remove(requestId)?.completeExceptionally(
                InvokeException(error)
            )
        } else {
            listener.onError(InvokeErrorParser.parse(obj["error"]))
        }
    }

    private fun handleEvent(obj: JsonObject) {
        val eventType = (obj["event"] as? JsonPrimitive)?.content ?: return
        val payload = obj["payload"] as? JsonObject ?: JsonObject(emptyMap())
        listener.onEvent(eventType, payload)
    }

    private fun send(message: JsonObject) {
        val text = message.toString()
        val sent = webSocket?.send(text) ?: false
        if (!sent) {
            Log.w(TAG, "Failed to send message")
        }
    }

    private fun startPingLoop() {
        pingJob?.cancel()
        pingJob = scope.launch(Dispatchers.IO) {
            while (isActive && connected.get()) {
                delay(PING_INTERVAL_MS)
                if (connected.get()) {
                    send(buildJsonObject { put("type", CoreBlowProtocol.MSG_PING) })
                }
            }
        }
    }

    private fun onDisconnected() {
        val wasConnected = connected.getAndSet(false)
        pingJob?.cancel()
        webSocket = null
        pendingResults.values.forEach { it.cancel() }
        pendingResults.clear()

        if (shouldReconnect.get()) {
            scheduleReconnect()
        } else {
            listener.onStateChanged(GatewayConnectionState.DISCONNECTED)
        }
    }

    private fun scheduleReconnect() {
        listener.onStateChanged(GatewayConnectionState.RECONNECTING)
        reconnectAttempt++

        val delayMs = (RECONNECT_BASE_MS * (1L shl reconnectAttempt.coerceAtMost(5)))
            .coerceAtMost(RECONNECT_MAX_MS)

        Log.i(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempt)")

        scope.launch(Dispatchers.IO) {
            delay(delayMs)
            val endpoint = currentEndpoint ?: return@launch
            val options = currentOptions ?: return@launch
            doConnect(endpoint, options)
        }
    }
}

/**
 * Exception wrapping an [InvokeError] for coroutine-based error propagation.
 */
class InvokeException(val error: InvokeError) : Exception(error.message)
