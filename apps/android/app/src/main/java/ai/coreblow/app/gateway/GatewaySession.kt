package ai.coreblow.app.gateway

import android.util.Log
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
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
    val userAgent: String? = null,
)

private enum class GatewayConnectAuthSource {
    DEVICE_TOKEN, SHARED_TOKEN, BOOTSTRAP_TOKEN, PASSWORD, NONE,
}

data class GatewayConnectErrorDetails(
    val code: String?,
    val canRetryWithDeviceToken: Boolean,
    val recommendedNextStep: String?,
)

private data class SelectedConnectAuth(
    val authToken: String?, val authBootstrapToken: String?,
    val authDeviceToken: String?, val authPassword: String?,
    val signatureToken: String?, val authSource: GatewayConnectAuthSource,
    val attemptedDeviceTokenRetry: Boolean,
)

private class GatewayConnectFailure(val gatewayError: GatewaySession.ErrorShape) :
    IllegalStateException(gatewayError.message)

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
data class GatewayTlsParams(
    val required: Boolean,
    val fingerprint: String?,
    val stableId: String? = null,
    val expectedFingerprint: String? = null,
)

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

    // ── Invoke result type ───────────────────────────────

    data class InvokeRequest(val id: String, val nodeId: String, val command: String, val paramsJson: String?, val timeoutMs: Long?)

    data class InvokeResult(val ok: Boolean, val payloadJson: String?, val error: ErrorShape?) {
        companion object {
            fun ok(payloadJson: String?) = InvokeResult(ok = true, payloadJson = payloadJson, error = null)
            fun error(code: String, message: String) = InvokeResult(ok = false, payloadJson = null, error = ErrorShape(code = code, message = message))
        }
    }

    data class ErrorShape(val code: String, val message: String, val details: GatewayConnectErrorDetails? = null)

    companion object {
        private const val TAG = "GatewaySession"
        private const val PING_INTERVAL_MS = 25_000L
        private const val RECONNECT_BASE_MS = 1_000L
        private const val RECONNECT_MAX_MS = 30_000L
        private const val REQUEST_TIMEOUT_MS = 30_000L
        private const val CONNECT_TIMEOUT_SEC = 15L
        private const val CONNECT_RPC_TIMEOUT_MS = 12_000L
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val writeLock = Mutex()
    private val connected = AtomicBoolean(false)
    private val shouldReconnect = AtomicBoolean(false)
    private val pendingRequests = ConcurrentHashMap<String, CompletableDeferred<String>>()
    private val messageSeq = AtomicLong(0)

    private var webSocket: WebSocket? = null
    private var pingJob: Job? = null
    private var reconnectAttempt = 0
    private var lastEventSeq: Long = -1

    @Volatile private var canvasHostUrl: String? = null
    @Volatile private var mainSessionKey: String? = null
    @Volatile private var pendingDeviceTokenRetry = false
    @Volatile private var deviceTokenRetryBudgetUsed = false
    @Volatile private var reconnectPausedForAuthFailure = false

    private var currentEndpoint: GatewayEndpoint? = null
    private var currentOptions: GatewayConnectOptions? = null
    private var currentTlsParams: GatewayTlsParams? = null
    private var authToken: String? = null
    private var bootstrapToken: String? = null
    private var password: String? = null

    val isConnected: Boolean get() = connected.get()
    fun currentCanvasHostUrl(): String? = canvasHostUrl
    fun currentMainSessionKey(): String? = mainSessionKey

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
        pendingDeviceTokenRetry = false
        deviceTokenRetryBudgetUsed = false
        reconnectPausedForAuthFailure = false
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
        pendingDeviceTokenRetry = false
        deviceTokenRetryBudgetUsed = false
        reconnectPausedForAuthFailure = false
        pingJob?.cancel()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        canvasHostUrl = null
        mainSessionKey = null
        cancelPendingRequests("disconnected")
        listenerRef?.onStateChanged(GatewayConnectionState.DISCONNECTED)
        onDisconnectedCb?.invoke("Offline")
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
     * Send a node event. Returns true if ack'd.
     */
    suspend fun sendNodeEvent(event: String, payloadJson: String?): Boolean {
        if (!connected.get()) return false
        val parsedPayload = payloadJson?.let { parseJsonOrNull(it) }
        val params = buildJsonObject {
            put("event", JsonPrimitive(event))
            if (parsedPayload != null) put("payload", parsedPayload)
            else if (payloadJson != null) put("payloadJSON", JsonPrimitive(payloadJson))
            else put("payloadJSON", JsonNull)
        }
        val msg = buildJsonObject {
            put("type", CoreBlowProtocol.MSG_EVENT)
            put("event", event)
            if (parsedPayload != null) put("payload", parsedPayload)
            else put("payload", JsonPrimitive(payloadJson ?: ""))
        }
        return send(msg)
    }

    /**
     * Refresh canvas capability from gateway.
     */
    suspend fun refreshNodeCanvasCapability(timeoutMs: Long = 8_000): Boolean {
        if (!connected.get()) return false
        return try {
            val result = request("node.canvas.capability.refresh", "{}")
            val obj = parseJsonOrNull(result)?.let { it as? JsonObject }
            val cap = (obj?.get("canvasCapability") as? JsonPrimitive)?.content?.trim().orEmpty()
            val url = canvasHostUrl?.trim().orEmpty()
            if (cap.isEmpty() || url.isEmpty()) return false
            val refreshed = replaceCanvasCapabilityInScopedHostUrl(url, cap) ?: return false
            canvasHostUrl = refreshed
            true
        } catch (err: Throwable) {
            Log.w(TAG, "canvas capability refresh failed: ${err.message}"); false
        }
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
            pendingDeviceTokenRetry = false
            deviceTokenRetryBudgetUsed = false
            reconnectPausedForAuthFailure = false
            listenerRef?.onStateChanged(GatewayConnectionState.CONNECTED)

            val serverName = (obj["serverName"] as? JsonPrimitive)?.content
            val remoteAddress = (obj["remoteAddress"] as? JsonPrimitive)?.content

            // Extract auth result fields
            val authObj = obj["auth"] as? JsonObject
            val deviceToken = (authObj?.get("deviceToken") as? JsonPrimitive)?.content
            if (!deviceToken.isNullOrBlank()) {
                deviceAuthStore?.saveToken(deviceToken)
                authToken = deviceToken
            }

            // Canvas host URL normalization
            val rawCanvas = (obj["canvasHostUrl"] as? JsonPrimitive)?.content
            canvasHostUrl = normalizeCanvasHostUrl(rawCanvas, currentEndpoint, currentTlsParams != null)

            // Session defaults
            val snapshot = obj["snapshot"] as? JsonObject
            val sessionDefaults = snapshot?.get("sessionDefaults") as? JsonObject
            mainSessionKey = (sessionDefaults?.get("mainSessionKey") as? JsonPrimitive)?.content

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
        canvasHostUrl = null
        mainSessionKey = null
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
        val delayMs = minOf(RECONNECT_MAX_MS, (350.0 * Math.pow(1.7, reconnectAttempt.toDouble())).toLong())
        Log.i(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempt)")
        scope.launch(Dispatchers.IO) {
            delay(delayMs)
            val endpoint = currentEndpoint ?: return@launch
            val options = currentOptions ?: return@launch
            doConnect(endpoint, options, currentTlsParams)
        }
    }

    // MARK: - Canvas URL normalization

    private fun normalizeCanvasHostUrl(raw: String?, endpoint: GatewayEndpoint?, isTls: Boolean): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isBlank() || endpoint == null) return null
        val parsed = runCatching { java.net.URI(trimmed) }.getOrNull()
        val host = parsed?.host?.trim().orEmpty()
        if (host.isEmpty()) return trimmed.ifBlank { null }
        if (!isLoopbackHost(host)) return trimmed
        val fallbackHost = endpoint.tailnetDns?.trim()?.takeIf { it.isNotEmpty() }
            ?: endpoint.lanHost?.trim()?.takeIf { it.isNotEmpty() }
            ?: endpoint.host.trim()
        if (fallbackHost.isEmpty()) return trimmed.ifBlank { null }
        val scheme = if (isTls) "https" else (parsed?.scheme?.trim().orEmpty().ifBlank { "http" })
        val port = if (isTls) endpoint.port else (endpoint.canvasPort ?: endpoint.port)
        val fmtHost = if (fallbackHost.contains(":")) "[$fallbackHost]" else fallbackHost
        val portSuffix = if ((scheme == "https" && port == 443) || (scheme == "http" && port == 80)) "" else ":$port"
        return "$scheme://$fmtHost$portSuffix"
    }

    private fun isLoopbackHost(raw: String?): Boolean {
        val host = raw?.trim()?.lowercase().orEmpty()
        return host == "localhost" || host == "::1" || host == "0.0.0.0" || host == "::" || host.startsWith("127.")
    }

    // ── Connection diagnostics (OC parity) ──────────────

    fun pendingInvokeCount(): Int = pendingRequests.size

    fun connectionDiagnosticSnapshot(): Map<String, Any?> = mapOf(
        "connected" to connected.get(),
        "reconnectAttempt" to reconnectAttempt,
        "pendingRequests" to pendingRequests.size,
        "canvasHostUrl" to canvasHostUrl,
        "mainSessionKey" to mainSessionKey,
        "lastEventSeq" to lastEventSeq,
        "pendingDeviceTokenRetry" to pendingDeviceTokenRetry,
        "reconnectPausedForAuthFailure" to reconnectPausedForAuthFailure,
    )

    fun currentEndpointLabel(): String? = currentEndpoint?.label

    fun currentEndpointHost(): String? = currentEndpoint?.host

    fun currentEndpointPort(): Int? = currentEndpoint?.port

    // ── Static helpers (test support & OC parity) ───────

    companion object {
        const val DEFAULT_INVOKE_TIMEOUT_MS = 30_000L
        const val PING_INTERVAL_MS_EXPOSED = PING_INTERVAL_MS
        const val PONG_TIMEOUT_MS = PING_INTERVAL_MS + 5_000L
        const val MAX_RECONNECT_BACKOFF_MS = RECONNECT_MAX_MS
        const val MAX_CONCURRENT_INVOKES = 64
        const val MAX_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024 // 16MB

        fun nextSequenceId(): Long = System.nanoTime()

        fun reconnectBackoffMs(attempt: Int): Long {
            if (attempt <= 0) return RECONNECT_BASE_MS
            val raw = (350.0 * Math.pow(1.7, attempt.toDouble())).toLong()
            return minOf(raw, RECONNECT_MAX_MS)
        }

        fun buildConnectUrl(host: String, port: Int, tls: Boolean): String {
            val scheme = if (tls) "wss" else "ws"
            return "$scheme://$host:$port/v1/gateway"
        }

        fun isRetryableError(t: Throwable): Boolean = when (t) {
            is java.net.SocketTimeoutException, is java.net.ConnectException,
            is java.io.IOException -> true
            is SecurityException -> false
            else -> false
        }

        fun isBinaryFrame(data: ByteArray): Boolean = data.isNotEmpty()

        fun createForTest(): GatewaySession = GatewaySession(
            scope = CoroutineScope(Dispatchers.Default),
            identityStore = null, deviceAuthStore = null, listenerRef = null,
            onConnectedCb = null, onDisconnectedCb = null, onEventCb = null, onInvokeCb = null,
        )

        fun buildAuthPayload(
            token: String?, bootstrapToken: String?, deviceToken: String?, password: String?,
        ): JsonObject = buildJsonObject {
            when {
                !deviceToken.isNullOrBlank() && !token.isNullOrBlank() -> {
                    put("token", token); put("deviceToken", deviceToken)
                }
                !deviceToken.isNullOrBlank() -> put("token", deviceToken)
                !token.isNullOrBlank() -> put("token", token)
                !bootstrapToken.isNullOrBlank() -> put("bootstrapToken", bootstrapToken)
            }
            if (!password.isNullOrBlank()) put("password", password)
        }

        fun rewriteCanvasCapabilityUrl(original: String?, newCap: String): String? {
            if (original == null) return null
            return replaceCanvasCapabilityInScopedHostUrl(original, newCap)
        }

        fun parseConnectResponse(json: String): ConnectResponsePayload? = try {
            val obj = Json.parseToJsonElement(json) as? JsonObject ?: return null
            val payload = obj["payload"] as? JsonObject ?: return null
            val canvasHostUrl = (payload["canvasHostUrl"] as? JsonPrimitive)?.content
            val snapshot = payload["snapshot"] as? JsonObject
            val sessionDefaults = snapshot?.get("sessionDefaults") as? JsonObject
            val mainSessionKey = (sessionDefaults?.get("mainSessionKey") as? JsonPrimitive)?.content
            ConnectResponsePayload(canvasHostUrl = canvasHostUrl, mainSessionKey = mainSessionKey)
        } catch (_: Throwable) { null }

        fun isTokenMismatchError(code: String?): Boolean = code == "AUTH_TOKEN_MISMATCH"

        fun isPairingRequiredError(code: String?): Boolean =
            code == "DEVICE_NOT_PAIRED" || code == "PAIRING_REQUIRED"

        data class DisconnectReason(val code: Int, val message: String) {
            val isNormal: Boolean get() = code == 1000 || code == 1001
        }

        data class ConnectResponsePayload(val canvasHostUrl: String?, val mainSessionKey: String?)

        object State {
            const val Disconnected = "Disconnected"
            const val Connecting = "Connecting"
            const val Connected = "Connected"
            const val Reconnecting = "Reconnecting"

            val entries: List<String> get() = listOf(Disconnected, Connecting, Connected, Reconnecting)
            fun valueOf(name: String): String = entries.firstOrNull { it == name } ?: throw IllegalArgumentException("No state: $name")
        }

        object InvokeResult {
            fun ok(payloadJson: String?) = GatewaySession.InvokeResult(ok = true, payloadJson = payloadJson, error = null)
            fun error(code: String, message: String) = GatewaySession.InvokeResult(ok = false, payloadJson = null, error = ErrorShape(code, message))
            fun fromException(ex: Throwable): GatewaySession.InvokeResult {
                val msg = ex.message ?: "unknown error"
                val colonIdx = msg.indexOf(": ")
                return if (colonIdx > 0 && msg.substring(0, colonIdx).all { it.isUpperCase() || it == '_' }) {
                    error(msg.substring(0, colonIdx), msg.substring(colonIdx + 2))
                } else {
                    error("INTERNAL_ERROR", msg)
                }
            }
        }
    }
}

/**
 * Exception wrapping an [InvokeError] for coroutine-based error propagation.
 */
class InvokeException(val error: InvokeError) : Exception(error.message)

private fun parseJsonOrNull(payload: String): JsonElement? {
    val trimmed = payload.trim()
    if (trimmed.isEmpty()) return null
    return try { Json.parseToJsonElement(trimmed) } catch (_: Throwable) { null }
}

internal fun replaceCanvasCapabilityInScopedHostUrl(scopedUrl: String, capability: String): String? {
    val marker = "/__coreblow__/cap/"
    val markerStart = scopedUrl.indexOf(marker)
    if (markerStart < 0) return null
    val capabilityStart = markerStart + marker.length
    val slashEnd = scopedUrl.indexOf("/", capabilityStart).takeIf { it >= 0 }
    val queryEnd = scopedUrl.indexOf("?", capabilityStart).takeIf { it >= 0 }
    val fragmentEnd = scopedUrl.indexOf("#", capabilityStart).takeIf { it >= 0 }
    val capabilityEnd = listOfNotNull(slashEnd, queryEnd, fragmentEnd).minOrNull() ?: scopedUrl.length
    if (capabilityEnd <= capabilityStart) return null
    return scopedUrl.substring(0, capabilityStart) + capability + scopedUrl.substring(capabilityEnd)
}

internal fun resolveInvokeResultAckTimeoutMs(invokeTimeoutMs: Long?): Long {
    val normalized = invokeTimeoutMs?.takeIf { it > 0L } ?: 15_000L
    return normalized.coerceIn(15_000L, 120_000L)
}
