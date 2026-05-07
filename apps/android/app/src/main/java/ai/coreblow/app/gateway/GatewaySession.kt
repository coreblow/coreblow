package ai.coreblow.app.gateway

import android.util.Log
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
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
 * Listener interface for gateway session events.
 */
interface GatewaySessionListener {
    fun onStateChanged(state: GatewayConnectionState)
    fun onInvokeRequest(requestId: String, command: String, params: JsonObject)
    fun onEvent(eventType: String, payload: JsonObject)
    fun onError(error: InvokeError)
}

/**
 * Invoke request received from the gateway.
 */
data class InvokeRequest(val command: String, val paramsJson: String)

/**
 * TLS parameters for gateway connections.
 */
data class GatewayTlsParams(val required: Boolean, val fingerprint: String?)

/**
 * Manages a WebSocket connection to a CoreBlow gateway.
 *
 * Handles the full lifecycle: connect → hello → auth → invoke/result → reconnect.
 * Supports both listener-based and callback-based construction for flexibility.
 */
class GatewaySession private constructor(
    private val scope: CoroutineScope,
    private val identityStore: DeviceIdentityStore?,
    private val deviceAuthStore: DeviceAuthStore?,
    private val listenerRef: GatewaySessionListener?,
    // Callback-based hooks (used by NodeRuntime)
    private val onConnectedCb: ((serverName: String?, remoteAddress: String?, mainSessionKey: String?) -> Unit)?,
    private val onDisconnectedCb: ((message: String) -> Unit)?,
    private val onEventCb: ((event: String, payloadJson: String?) -> Unit)?,
    private val onInvokeCb: ((InvokeRequest) -> String?)?,
) {
    /**
     * Listener-based constructor (used by ViewModels).
     */
    constructor(
        scope: CoroutineScope,
        listener: GatewaySessionListener,
    ) : this(scope, null, null, listener, null, null, null, null)

    /**
     * Callback-based constructor (used by NodeRuntime).
     */
    constructor(
        scope: CoroutineScope,
        identityStore: DeviceIdentityStore,
        deviceAuthStore: DeviceAuthStore,
        onConnected: (serverName: String?, remoteAddress: String?, mainSessionKey: String?) -> Unit,
        onDisconnected: (message: String) -> Unit,
        onEvent: (event: String, payloadJson: String?) -> Unit,
        onInvoke: ((InvokeRequest) -> String?)? = null,
    ) : this(scope, identityStore, deviceAuthStore, null, onConnected, onDisconnected, onEvent, onInvoke)

    companion object {
        private const val TAG = "GatewaySession"
        private const val PING_INTERVAL_MS = 25_000L
        private const val RECONNECT_BASE_MS = 1_000L
        private const val RECONNECT_MAX_MS = 30_000L
        private const val REQUEST_TIMEOUT_MS = 30_000L
        private const val CONNECT_TIMEOUT_SEC = 15L
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val connected = AtomicBoolean(false)
    private val shouldReconnect = AtomicBoolean(false)
    private val pendingRequests = ConcurrentHashMap<String, CompletableDeferred<String>>()
    private val messageSeq = AtomicLong(0)

    private var webSocket: WebSocket? = null
    private var pingJob: Job? = null
    private var reconnectAttempt = 0
    private var lastEventSeq: Long = -1

    private var currentEndpoint: GatewayEndpoint? = null
    private var currentOptions: GatewayConnectOptions? = null
    private var currentTlsParams: GatewayTlsParams? = null
    private var authToken: String? = null
    private var bootstrapToken: String? = null
    private var password: String? = null

    val isConnected: Boolean get() = connected.get()

    // MARK: - Connect / Disconnect

    fun connect(
        endpoint: GatewayEndpoint,
        token: String?,
        bootstrapToken: String?,
        password: String?,
        options: GatewayConnectOptions,
        tlsParams: GatewayTlsParams?,
    ) {
        currentEndpoint = endpoint
        currentOptions = options
        currentTlsParams = tlsParams
        authToken = token
        this.bootstrapToken = bootstrapToken
        this.password = password
        shouldReconnect.set(true)
        reconnectAttempt = 0
        doConnect(endpoint, options, tlsParams)
    }

    fun connect(endpoint: GatewayEndpoint, options: GatewayConnectOptions, token: String?) {
        connect(endpoint, token, null, null, options, null)
    }

    fun disconnect() {
        shouldReconnect.set(false)
        connected.set(false)
        pingJob?.cancel()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        cancelPendingRequests("disconnected")
        listenerRef?.onStateChanged(GatewayConnectionState.DISCONNECTED)
        onDisconnectedCb?.invoke("Disconnected")
    }

    fun reconnect() {
        if (connected.get()) return
        val endpoint = currentEndpoint ?: return
        val options = currentOptions ?: return
        shouldReconnect.set(true)
        reconnectAttempt = 0
        doConnect(endpoint, options, currentTlsParams)
    }

    // MARK: - Request/Response

    /**
     * Send a request and await a response. Throws on timeout or error.
     */
    suspend fun request(method: String, paramsJson: String?): String {
        val id = UUID.randomUUID().toString()
        val deferred = CompletableDeferred<String>()
        pendingRequests[id] = deferred

        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_INVOKE)
            put("id", id)
            put("command", method)
            if (paramsJson != null) {
                try {
                    put("params", json.parseToJsonElement(paramsJson))
                } catch (_: Throwable) {
                    put("params", JsonPrimitive(paramsJson))
                }
            }
        }
        send(msg)

        return try {
            withTimeout(REQUEST_TIMEOUT_MS) { deferred.await() }
        } catch (e: Throwable) {
            pendingRequests.remove(id)
            throw e
        }
    }

    /**
     * Fire-and-forget node event.
     */
    fun sendNodeEvent(event: String, payloadJson: String): Boolean {
        if (!connected.get()) return false
        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_EVENT)
            put("event", event)
            try {
                put("payload", json.parseToJsonElement(payloadJson))
            } catch (_: Throwable) {
                put("payload", JsonPrimitive(payloadJson))
            }
        }
        return send(msg)
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

    // MARK: - Private: Connect

    private fun doConnect(endpoint: GatewayEndpoint, options: GatewayConnectOptions, tlsParams: GatewayTlsParams?) {
        listenerRef?.onStateChanged(GatewayConnectionState.CONNECTING)

        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_SEC, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(PING_INTERVAL_MS, TimeUnit.MILLISECONDS)

        val effectiveTls = tlsParams ?: if (endpoint.useTls) GatewayTlsParams(true, null) else null
        GatewayTls.configureClient(clientBuilder, effectiveTls)

        val client = clientBuilder.build()
        val request = Request.Builder().url(endpoint.wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket opened to ${endpoint.label}")
                connected.set(true)
                reconnectAttempt = 0
                lastEventSeq = -1
                sendHello(options)
                startPingLoop()
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closing: $code $reason")
                ws.close(code, reason)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $code $reason")
                onDisconnected(reason)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}")
                onDisconnected(t.message ?: "Connection failed")
            }
        })
    }

    // MARK: - Private: Hello

    private fun sendHello(options: GatewayConnectOptions) {
        listenerRef?.onStateChanged(GatewayConnectionState.AUTHENTICATING)

        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_HELLO)
            put("version", CoreBlowProtocol.PROTOCOL_VERSION)
            put("role", options.role)
            putJsonArray("scopes") { options.scopes.forEach { add(JsonPrimitive(it)) } }
            putJsonArray("caps") { options.capabilities.forEach { add(JsonPrimitive(it)) } }
            putJsonArray("commands") { options.commands.forEach { add(JsonPrimitive(it)) } }
            putJsonObject("permissions") {
                options.permissions.forEach { (k, v) -> put(k, v) }
            }
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

            // Auth block
            val token = authToken
            val bootstrap = bootstrapToken
            val pass = password
            when {
                !token.isNullOrBlank() -> putJsonObject("auth") {
                    put("type", CoreBlowProtocol.AUTH_DEVICE_TOKEN)
                    put("token", token)
                }
                !bootstrap.isNullOrBlank() -> putJsonObject("auth") {
                    put("type", "bootstrap")
                    put("token", bootstrap)
                }
                !pass.isNullOrBlank() -> putJsonObject("auth") {
                    put("type", "password")
                    put("password", pass)
                }
            }
        }
        send(msg)
    }

    // MARK: - Private: Message Handling

    private fun handleMessage(text: String) {
        val obj = try {
            json.parseToJsonElement(text) as? JsonObject ?: return
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message: ${e.message}")
            return
        }

        val type = (obj["type"] as? JsonPrimitive)?.content ?: return

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
            listenerRef?.onStateChanged(GatewayConnectionState.CONNECTED)

            // Extract server info for callback-based usage
            val serverName = (obj["serverName"] as? JsonPrimitive)?.content
            val remoteAddress = (obj["remoteAddress"] as? JsonPrimitive)?.content
            val mainSessionKey = (obj["mainSessionKey"] as? JsonPrimitive)?.content

            // Save provisioned token if present
            val provisionedToken = (obj["token"] as? JsonPrimitive)?.content?.trim()
            if (!provisionedToken.isNullOrEmpty()) {
                deviceAuthStore?.saveToken(provisionedToken)
                authToken = provisionedToken
            }

            onConnectedCb?.invoke(serverName, remoteAddress, mainSessionKey)
        } else {
            val error = InvokeErrorParser.parse(obj["error"])
            Log.e(TAG, "Authentication failed: ${error.message}")
            listenerRef?.onError(error)
            disconnect()
        }
    }

    private fun handleInvoke(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content ?: UUID.randomUUID().toString()
        val command = (obj["command"] as? JsonPrimitive)?.content ?: return
        val params = obj["params"] as? JsonObject ?: JsonObject(emptyMap())

        // Callback path
        if (onInvokeCb != null) {
            scope.launch {
                try {
                    val result = onInvokeCb.invoke(InvokeRequest(command, params.toString()))
                    if (result != null) {
                        sendResult(requestId, json.parseToJsonElement(result))
                    } else {
                        sendResult(requestId, JsonObject(emptyMap()))
                    }
                } catch (e: Throwable) {
                    sendError(requestId, InvokeError("INVOKE_FAILED", e.message ?: "unknown"))
                }
            }
            return
        }

        // Listener path
        listenerRef?.onInvokeRequest(requestId, command, params)
    }

    private fun handleResult(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content ?: return
        val resultJson = (obj["result"] ?: JsonNull).toString()
        pendingRequests.remove(requestId)?.complete(resultJson)
    }

    private fun handleError(obj: JsonObject) {
        val requestId = (obj["id"] as? JsonPrimitive)?.content
        val error = InvokeErrorParser.parse(obj["error"])
        if (requestId != null) {
            pendingRequests.remove(requestId)?.completeExceptionally(InvokeException(error))
        } else {
            listenerRef?.onError(error)
        }
    }

    private fun handleEvent(obj: JsonObject) {
        val eventType = (obj["event"] as? JsonPrimitive)?.content ?: return

        // Sequence gap detection
        val seq = (obj["seq"] as? JsonPrimitive)?.content?.toLongOrNull()
        if (seq != null && lastEventSeq >= 0 && seq > lastEventSeq + 1) {
            Log.w(TAG, "Event sequence gap: expected ${lastEventSeq + 1}, got $seq")
            onEventCb?.invoke("seqGap", null)
            listenerRef?.onEvent("seqGap", JsonObject(emptyMap()))
        }
        if (seq != null) lastEventSeq = seq

        val payload = obj["payload"] as? JsonObject ?: JsonObject(emptyMap())
        listenerRef?.onEvent(eventType, payload)
        onEventCb?.invoke(eventType, payload.toString())
    }

    // MARK: - Private: Helpers

    private fun send(message: JsonObject): Boolean {
        val text = message.toString()
        val sent = webSocket?.send(text) ?: false
        if (!sent) Log.w(TAG, "Failed to send message")
        return sent
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

    private fun onDisconnected(reason: String = "Disconnected") {
        val wasConnected = connected.getAndSet(false)
        pingJob?.cancel()
        webSocket = null
        cancelPendingRequests(reason)

        if (shouldReconnect.get()) {
            scheduleReconnect()
        } else {
            listenerRef?.onStateChanged(GatewayConnectionState.DISCONNECTED)
            onDisconnectedCb?.invoke(reason)
        }
    }

    private fun cancelPendingRequests(reason: String) {
        pendingRequests.values.forEach {
            it.completeExceptionally(Exception(reason))
        }
        pendingRequests.clear()
    }

    private fun scheduleReconnect() {
        listenerRef?.onStateChanged(GatewayConnectionState.RECONNECTING)
        reconnectAttempt++

        val delayMs = (RECONNECT_BASE_MS * (1L shl reconnectAttempt.coerceAtMost(5)))
            .coerceAtMost(RECONNECT_MAX_MS)

        Log.i(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempt)")

        scope.launch(Dispatchers.IO) {
            delay(delayMs)
            val endpoint = currentEndpoint ?: return@launch
            val options = currentOptions ?: return@launch
            doConnect(endpoint, options, currentTlsParams)
        }
    }
}

/**
 * Exception wrapping an [InvokeError] for coroutine-based error propagation.
 */
class InvokeException(val error: InvokeError) : Exception(error.message)
