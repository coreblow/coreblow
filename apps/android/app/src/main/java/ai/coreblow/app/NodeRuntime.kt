package ai.coreblow.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import ai.coreblow.app.chat.ChatController
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatPendingToolCall
import ai.coreblow.app.chat.ChatSessionEntry
import ai.coreblow.app.chat.OutgoingAttachment
import ai.coreblow.app.gateway.DeviceAuthStore
import ai.coreblow.app.gateway.DeviceIdentityStore
import ai.coreblow.app.gateway.GatewayDiscovery
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.gateway.GatewaySession
import ai.coreblow.app.node.*
import ai.coreblow.app.node.handlers.*
import ai.coreblow.app.voice.MicCaptureManager
import ai.coreblow.app.voice.TalkModeManager
import ai.coreblow.app.voice.VoiceConversationEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

class NodeRuntime(
    context: Context,
    val prefs: SecurePrefs = SecurePrefs(context.applicationContext),
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val deviceAuthStore = DeviceAuthStore(prefs)
    val canvas = CanvasController()
    val camera = CameraCaptureManager(appContext)
    val location = LocationCaptureManager(appContext)
    private val json = Json { ignoreUnknownKeys = true }

    private val externalAudioCaptureActive = MutableStateFlow(false)
    private val discovery = GatewayDiscovery(appContext, scope = scope)
    val gateways: StateFlow<List<GatewayEndpoint>> = discovery.gateways
    val discoveryStatusText: StateFlow<String> = discovery.statusText

    private val identityStore = DeviceIdentityStore(appContext)
    private var connectedEndpoint: GatewayEndpoint? = null

    // MARK: - Node Handlers

    private val cameraHandler = CameraHandler(
        appContext = appContext,
        camera = camera,
        externalAudioCaptureActive = externalAudioCaptureActive,
        showCameraHud = ::showCameraHud,
        triggerCameraFlash = ::triggerCameraFlash,
        invokeErrorFromThrowable = { invokeErrorFromThrowable(it) },
    )

    private val locationHandler = LocationHandler(
        appContext = appContext,
        location = location,
        json = json,
        isForeground = { _isForeground.value },
        locationPreciseEnabled = { locationPreciseEnabled.value },
    )

    private val deviceHandler = DeviceHandler(appContext = appContext)
    private val photosHandler = PhotosHandler(appContext = appContext)
    private val contactsHandler = ContactsHandler(appContext = appContext)
    private val calendarHandler = CalendarHandler(appContext = appContext)
    private val a2uiHandler = A2UIHandler(canvas = canvas, json = json)

    private val connectionManager = ConnectionManager(
        prefs = prefs,
        cameraEnabled = { cameraEnabled.value },
        locationMode = { locationMode.value },
        voiceWakeMode = { VoiceWakeMode.Off },
        hasRecordAudioPermission = { hasRecordAudioPermission() },
        manualTls = { manualTls.value },
    )

    private val invokeDispatcher = InvokeDispatcher(
        canvas = canvas,
        cameraHandler = cameraHandler,
        locationHandler = locationHandler,
        deviceHandler = deviceHandler,
        photosHandler = photosHandler,
        contactsHandler = contactsHandler,
        calendarHandler = calendarHandler,
        a2uiHandler = a2uiHandler,
        isForeground = { _isForeground.value },
        cameraEnabled = { cameraEnabled.value },
        locationEnabled = { locationMode.value != LocationMode.Off },
    )

    // MARK: - Gateway Trust

    data class GatewayTrustPrompt(
        val endpoint: GatewayEndpoint,
        val fingerprintSha256: String,
    )

    // MARK: - State Flows

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    private val _nodeConnected = MutableStateFlow(false)
    val nodeConnected: StateFlow<Boolean> = _nodeConnected.asStateFlow()

    private val _statusText = MutableStateFlow("Offline")
    val statusText: StateFlow<String> = _statusText.asStateFlow()

    private val _pendingGatewayTrust = MutableStateFlow<GatewayTrustPrompt?>(null)
    val pendingGatewayTrust: StateFlow<GatewayTrustPrompt?> = _pendingGatewayTrust.asStateFlow()

    private val _mainSessionKey = MutableStateFlow(resolveNodeMainSessionKey())
    val mainSessionKey: StateFlow<String> = _mainSessionKey.asStateFlow()

    private val cameraHudSeq = AtomicLong(0)
    private val _cameraHud = MutableStateFlow<CameraHudState?>(null)
    val cameraHud: StateFlow<CameraHudState?> = _cameraHud.asStateFlow()

    private val _cameraFlashToken = MutableStateFlow(0L)
    val cameraFlashToken: StateFlow<Long> = _cameraFlashToken.asStateFlow()

    private val _canvasA2uiHydrated = MutableStateFlow(false)
    val canvasA2uiHydrated: StateFlow<Boolean> = _canvasA2uiHydrated.asStateFlow()
    private val _canvasRehydratePending = MutableStateFlow(false)
    val canvasRehydratePending: StateFlow<Boolean> = _canvasRehydratePending.asStateFlow()
    private val _canvasRehydrateErrorText = MutableStateFlow<String?>(null)
    val canvasRehydrateErrorText: StateFlow<String?> = _canvasRehydrateErrorText.asStateFlow()

    private val _serverName = MutableStateFlow<String?>(null)
    val serverName: StateFlow<String?> = _serverName.asStateFlow()
    private val _remoteAddress = MutableStateFlow<String?>(null)
    val remoteAddress: StateFlow<String?> = _remoteAddress.asStateFlow()
    private val _seamColorArgb = MutableStateFlow(DEFAULT_SEAM_COLOR_ARGB)
    val seamColorArgb: StateFlow<Long> = _seamColorArgb.asStateFlow()
    private val _isForeground = MutableStateFlow(true)
    val isForeground: StateFlow<Boolean> = _isForeground.asStateFlow()

    private var gatewayDefaultAgentId: String? = null
    private var gatewayAgents: List<GatewayAgentSummary> = emptyList()
    private var didAutoRequestCanvasRehydrate = false
    private val canvasRehydrateSeq = AtomicLong(0)
    private var operatorConnected = false
    private var operatorStatusText: String = "Offline"
    private var nodeStatusText: String = "Offline"

    // MARK: - Sessions

    private val operatorSession = GatewaySession(
        scope = scope,
        identityStore = identityStore,
        deviceAuthStore = deviceAuthStore,
        onConnected = { name, remote, mainSessionKey ->
            operatorConnected = true
            operatorStatusText = "Connected"
            _serverName.value = name
            _remoteAddress.value = remote
            _seamColorArgb.value = DEFAULT_SEAM_COLOR_ARGB
            syncMainSessionKey(resolveAgentIdFromMainSessionKey(mainSessionKey))
            updateStatus()
            micCapture.onGatewayConnectionChanged(true)
            scope.launch { refreshBrandingFromGateway(); refreshAgentsFromGateway() }
        },
        onDisconnected = { message ->
            operatorConnected = false
            operatorStatusText = message
            _serverName.value = null
            _remoteAddress.value = null
            _seamColorArgb.value = DEFAULT_SEAM_COLOR_ARGB
            chat.applyMainSessionKey(resolveMainSessionKey())
            chat.onDisconnected(message)
            updateStatus()
            micCapture.onGatewayConnectionChanged(false)
        },
        onEvent = { event, payloadJson -> handleGatewayEvent(event, payloadJson) },
    )

    private val nodeSession = GatewaySession(
        scope = scope,
        identityStore = identityStore,
        deviceAuthStore = deviceAuthStore,
        onConnected = { _, _, _ ->
            _nodeConnected.value = true
            nodeStatusText = "Connected"
            didAutoRequestCanvasRehydrate = false
            _canvasA2uiHydrated.value = false
            _canvasRehydratePending.value = false
            _canvasRehydrateErrorText.value = null
            updateStatus()
        },
        onDisconnected = { message ->
            _nodeConnected.value = false
            nodeStatusText = message
            didAutoRequestCanvasRehydrate = false
            _canvasA2uiHydrated.value = false
            updateStatus()
        },
        onEvent = { _, _ -> },
        onInvoke = { req -> invokeDispatcher.handleInvoke(req.command, req.paramsJson) },
    )

    // MARK: - Chat & Voice

    private val chat = ChatController(
        scope = scope,
        session = operatorSession,
        json = json,
        supportsChatSubscribe = false,
    ).also { it.applyMainSessionKey(_mainSessionKey.value) }

    private val talkMode: TalkModeManager by lazy {
        TalkModeManager(
            context = appContext,
            scope = scope,
            session = operatorSession,
            supportsChatSubscribe = true,
            isConnected = { operatorConnected },
        )
    }

    private val micCapture: MicCaptureManager by lazy {
        MicCaptureManager(
            context = appContext,
            scope = scope,
            sendToGateway = { message, onRunIdKnown ->
                val idempotencyKey = UUID.randomUUID().toString()
                onRunIdKnown(idempotencyKey)
                val params = buildJsonObject {
                    put("sessionKey", JsonPrimitive(resolveMainSessionKey()))
                    put("message", JsonPrimitive(message))
                    put("thinking", JsonPrimitive(chatThinkingLevel.value))
                    put("timeoutMs", JsonPrimitive(30_000))
                    put("idempotencyKey", JsonPrimitive(idempotencyKey))
                }
                val response = operatorSession.request("chat.send", params.toString())
                parseChatSendRunId(response) ?: idempotencyKey
            },
            speakAssistantReply = { text ->
                if (!talkMode.ttsOnAllResponses) {
                    talkMode.speakAssistantReply(text)
                }
            },
        )
    }

    val micStatusText: StateFlow<String> get() = micCapture.statusText
    val micLiveTranscript: StateFlow<String?> get() = micCapture.liveTranscript
    val micIsListening: StateFlow<Boolean> get() = micCapture.isListening
    val micEnabled: StateFlow<Boolean> get() = micCapture.micEnabled
    val micCooldown: StateFlow<Boolean> get() = micCapture.micCooldown
    val micInputLevel: StateFlow<Float> get() = micCapture.inputLevel
    val micIsSending: StateFlow<Boolean> get() = micCapture.isSending

    // MARK: - Preference Delegates

    val instanceId: StateFlow<String> = prefs.instanceId
    val displayName: StateFlow<String> = prefs.displayName
    val cameraEnabled: StateFlow<Boolean> = prefs.cameraEnabled
    val locationMode: StateFlow<LocationMode> = prefs.locationMode
    val locationPreciseEnabled: StateFlow<Boolean> = prefs.locationPreciseEnabled
    val preventSleep: StateFlow<Boolean> = prefs.preventSleep
    val manualEnabled: StateFlow<Boolean> = prefs.manualEnabled
    val manualHost: StateFlow<String> = prefs.manualHost
    val manualPort: StateFlow<Int> = prefs.manualPort
    val manualTls: StateFlow<Boolean> = prefs.manualTls
    val gatewayToken: StateFlow<String> = prefs.gatewayToken
    val onboardingCompleted: StateFlow<Boolean> = prefs.onboardingCompleted
    val lastDiscoveredStableId: StateFlow<String> = prefs.lastDiscoveredStableId
    val canvasDebugStatusEnabled: StateFlow<Boolean> = prefs.canvasDebugStatusEnabled
    val speakerEnabled: StateFlow<Boolean> get() = prefs.speakerEnabled

    fun setGatewayToken(value: String) = prefs.setGatewayToken(value)
    fun setGatewayBootstrapToken(value: String) = prefs.setGatewayBootstrapToken(value)
    fun setGatewayPassword(value: String) = prefs.setGatewayPassword(value)
    fun setOnboardingCompleted(value: Boolean) = prefs.setOnboardingCompleted(value)
    fun setDisplayName(value: String) = prefs.setDisplayName(value)
    fun setCameraEnabled(value: Boolean) = prefs.setCameraEnabled(value)
    fun setLocationMode(mode: LocationMode) = prefs.setLocationMode(mode)
    fun setLocationPreciseEnabled(value: Boolean) = prefs.setLocationPreciseEnabled(value)
    fun setPreventSleep(value: Boolean) = prefs.setPreventSleep(value)
    fun setManualEnabled(value: Boolean) = prefs.setManualEnabled(value)
    fun setManualHost(value: String) = prefs.setManualHost(value)
    fun setManualPort(value: Int) = prefs.setManualPort(value)
    fun setManualTls(value: Boolean) = prefs.setManualTls(value)
    fun setCanvasDebugStatusEnabled(value: Boolean) = prefs.setCanvasDebugStatusEnabled(value)

    // MARK: - Chat Delegates

    private var didAutoConnect = false
    val chatSessionKey: StateFlow<String> = chat.sessionKey
    val chatSessionId: StateFlow<String?> = chat.sessionId
    val chatMessages: StateFlow<List<ChatMessage>> = chat.messages
    val chatError: StateFlow<String?> = chat.errorText
    val chatHealthOk: StateFlow<Boolean> = chat.healthOk
    val chatThinkingLevel: StateFlow<String> = chat.thinkingLevel
    val chatStreamingAssistantText: StateFlow<String?> = chat.streamingAssistantText
    val chatPendingToolCalls: StateFlow<List<ChatPendingToolCall>> = chat.pendingToolCalls
    val chatSessions: StateFlow<List<ChatSessionEntry>> = chat.sessions
    val pendingRunCount: StateFlow<Int> = chat.pendingRunCount

    // MARK: - Init

    init {
        scope.launch { prefs.loadGatewayToken() }

        scope.launch {
            prefs.talkEnabled.collect { enabled ->
                micCapture.setMicEnabled(enabled)
                if (enabled) {
                    talkMode.ttsOnAllResponses = true
                    scope.launch { talkMode.ensureChatSubscribed() }
                }
                externalAudioCaptureActive.value = enabled
            }
        }

        scope.launch(Dispatchers.Default) {
            gateways.collect { list ->
                seedLastDiscoveredGateway(list)
                autoConnectIfNeeded()
            }
        }
    }

    // MARK: - Foreground

    fun setForeground(value: Boolean) {
        _isForeground.value = value
        if (value) reconnectPreferredGatewayOnForeground()
        else stopActiveVoiceSession()
    }

    // MARK: - Connection

    fun connect(endpoint: GatewayEndpoint) {
        val tls = connectionManager.resolveTlsParams(endpoint)
        connectedEndpoint = endpoint
        operatorStatusText = "Connecting…"
        nodeStatusText = "Connecting…"
        updateStatus()
        val token = prefs.loadGatewayToken()
        val bootstrapToken = prefs.loadGatewayBootstrapToken()
        val password = prefs.loadGatewayPassword()
        operatorSession.connect(endpoint, token, bootstrapToken, password, connectionManager.buildOperatorConnectOptions(), tls)
        nodeSession.connect(endpoint, token, bootstrapToken, password, connectionManager.buildNodeConnectOptions(), tls)
    }

    fun refreshGatewayConnection() {
        val endpoint = connectedEndpoint ?: run {
            _statusText.value = "Failed: no cached gateway endpoint"
            return
        }
        operatorStatusText = "Connecting…"
        updateStatus()
        val token = prefs.loadGatewayToken()
        val bootstrapToken = prefs.loadGatewayBootstrapToken()
        val password = prefs.loadGatewayPassword()
        val tls = connectionManager.resolveTlsParams(endpoint)
        operatorSession.connect(endpoint, token, bootstrapToken, password, connectionManager.buildOperatorConnectOptions(), tls)
        nodeSession.connect(endpoint, token, bootstrapToken, password, connectionManager.buildNodeConnectOptions(), tls)
        operatorSession.reconnect()
        nodeSession.reconnect()
    }

    fun connectManual() {
        val host = manualHost.value.trim()
        val port = manualPort.value
        if (host.isEmpty() || port !in 1..65535) {
            _statusText.value = "Failed: invalid manual host/port"
            return
        }
        connect(GatewayEndpoint.manual(host = host, port = port))
    }

    fun disconnect() {
        connectedEndpoint = null
        _pendingGatewayTrust.value = null
        operatorSession.disconnect()
        nodeSession.disconnect()
    }

    fun acceptGatewayTrustPrompt() {
        val prompt = _pendingGatewayTrust.value ?: return
        _pendingGatewayTrust.value = null
        prefs.saveGatewayTlsFingerprint(prompt.endpoint.stableId, prompt.fingerprintSha256)
        connect(prompt.endpoint)
    }

    fun declineGatewayTrustPrompt() {
        _pendingGatewayTrust.value = null
        _statusText.value = "Offline"
    }

    // MARK: - Voice

    fun setMicEnabled(value: Boolean) {
        prefs.setTalkEnabled(value)
        if (value) {
            talkMode.stopTts()
            talkMode.ttsOnAllResponses = true
            scope.launch { talkMode.ensureChatSubscribed() }
        }
        micCapture.setMicEnabled(value)
        externalAudioCaptureActive.value = value
    }

    fun setSpeakerEnabled(value: Boolean) {
        prefs.setSpeakerEnabled(value)
        talkMode.setPlaybackEnabled(value)
    }

    fun setVoiceScreenActive(active: Boolean) {
        if (!active) stopActiveVoiceSession()
    }

    private fun stopActiveVoiceSession() {
        talkMode.ttsOnAllResponses = false
        talkMode.stopTts()
        micCapture.setMicEnabled(false)
        prefs.setTalkEnabled(false)
        externalAudioCaptureActive.value = false
    }

    // MARK: - Chat

    fun loadChat(sessionKey: String) {
        val key = sessionKey.trim().ifEmpty { resolveMainSessionKey() }
        chat.load(key)
    }

    fun refreshChat() = chat.refresh()
    fun refreshChatSessions(limit: Int? = null) = chat.refreshSessions(limit = limit)
    fun setChatThinkingLevel(level: String) = chat.setThinkingLevel(level)
    fun switchChatSession(sessionKey: String) = chat.switchSession(sessionKey)
    fun abortChat() = chat.abort()

    fun sendChat(message: String, thinking: String, attachments: List<OutgoingAttachment>) {
        chat.sendMessage(message = message, thinkingLevel = thinking, attachments = attachments)
    }

    // MARK: - Private Helpers

    private fun resolveNodeMainSessionKey(agentId: String? = gatewayDefaultAgentId): String {
        val deviceId = identityStore.loadOrCreate().deviceId
        return buildNodeMainSessionKey(deviceId, agentId)
    }

    private fun syncMainSessionKey(agentId: String?) {
        val resolvedKey = resolveNodeMainSessionKey(agentId)
        if (_mainSessionKey.value == resolvedKey) return
        _mainSessionKey.value = resolvedKey
        talkMode.setMainSessionKey(resolvedKey)
        chat.applyMainSessionKey(resolvedKey)
    }

    private fun resolveMainSessionKey(): String {
        val trimmed = _mainSessionKey.value.trim()
        return trimmed.ifEmpty { "main" }
    }

    private fun updateStatus() {
        _isConnected.value = operatorConnected
        _statusText.value = when {
            operatorConnected && _nodeConnected.value -> "Connected"
            operatorConnected && !_nodeConnected.value -> "Connected (node offline)"
            !operatorConnected && _nodeConnected.value -> "Connected (operator offline)"
            operatorStatusText.isNotBlank() && operatorStatusText != "Offline" -> operatorStatusText
            else -> nodeStatusText
        }
    }

    private fun handleGatewayEvent(event: String, payloadJson: String?) {
        micCapture.handleGatewayEvent(event, payloadJson)
        talkMode.handleGatewayEvent(event, payloadJson)
        chat.handleGatewayEvent(event, payloadJson)
    }

    private fun parseChatSendRunId(response: String): String? {
        return try {
            val root = json.parseToJsonElement(response) as? JsonObject ?: return null
            (root["runId"] as? JsonPrimitive)?.content
        } catch (_: Throwable) { null }
    }

    private fun hasRecordAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun seedLastDiscoveredGateway(list: List<GatewayEndpoint>) {
        if (list.isEmpty()) return
        if (lastDiscoveredStableId.value.trim().isNotEmpty()) return
        prefs.setLastDiscoveredStableId(list.first().stableId)
    }

    private fun resolvePreferredGatewayEndpoint(): GatewayEndpoint? {
        if (manualEnabled.value) {
            val host = manualHost.value.trim()
            val port = manualPort.value
            if (host.isEmpty() || port !in 1..65535) return null
            return GatewayEndpoint.manual(host = host, port = port)
        }
        val targetStableId = lastDiscoveredStableId.value.trim()
        if (targetStableId.isEmpty()) return null
        val endpoint = gateways.value.firstOrNull { it.stableId == targetStableId } ?: return null
        val storedFingerprint = prefs.loadGatewayTlsFingerprint(endpoint.stableId)?.trim().orEmpty()
        if (storedFingerprint.isEmpty()) return null
        return endpoint
    }

    private fun autoConnectIfNeeded() {
        if (didAutoConnect) return
        if (_isConnected.value) return
        val endpoint = resolvePreferredGatewayEndpoint() ?: return
        didAutoConnect = true
        connect(endpoint)
    }

    private fun reconnectPreferredGatewayOnForeground() {
        if (_isConnected.value) return
        if (_pendingGatewayTrust.value != null) return
        if (connectedEndpoint != null) { refreshGatewayConnection(); return }
        resolvePreferredGatewayEndpoint()?.let(::connect)
    }

    private suspend fun refreshBrandingFromGateway() {
        if (!_isConnected.value) return
        try {
            val res = operatorSession.request("config.get", "{}")
            val root = json.parseToJsonElement(res) as? JsonObject
            val config = root?.get("config") as? JsonObject
            val ui = config?.get("ui") as? JsonObject
            val raw = (ui?.get("seamColor") as? JsonPrimitive)?.content?.trim()
            val parsed = parseHexColorArgb(raw)
            _seamColorArgb.value = parsed ?: DEFAULT_SEAM_COLOR_ARGB
        } catch (_: Throwable) { /* ignore */ }
    }

    private suspend fun refreshAgentsFromGateway() {
        if (!operatorConnected) return
        try {
            val res = operatorSession.request("agents.list", "{}")
            val root = json.parseToJsonElement(res) as? JsonObject ?: return
            val defaultAgentId = (root["defaultId"] as? JsonPrimitive)?.content?.trim().orEmpty()
            val agents = (root["agents"] as? JsonArray)?.mapNotNull { item ->
                val obj = item as? JsonObject ?: return@mapNotNull null
                val id = (obj["id"] as? JsonPrimitive)?.content?.trim().orEmpty()
                if (id.isEmpty()) return@mapNotNull null
                val name = (obj["name"] as? JsonPrimitive)?.content?.trim()
                GatewayAgentSummary(id = id, name = name?.takeIf { it.isNotEmpty() })
            } ?: emptyList()
            gatewayDefaultAgentId = defaultAgentId.ifEmpty { null }
            gatewayAgents = agents
            syncMainSessionKey(gatewayDefaultAgentId)
        } catch (_: Throwable) { /* ignore */ }
    }

    private fun invokeErrorFromThrowable(t: Throwable): String = t.message ?: "unknown error"

    private fun triggerCameraFlash() {
        _cameraFlashToken.value = SystemClock.elapsedRealtimeNanos()
    }

    private fun showCameraHud(message: String, kind: CameraHudKind, autoHideMs: Long? = null) {
        val token = cameraHudSeq.incrementAndGet()
        _cameraHud.value = CameraHudState(token = token, kind = kind, message = message)
        if (autoHideMs != null && autoHideMs > 0) {
            scope.launch {
                delay(autoHideMs)
                if (_cameraHud.value?.token == token) _cameraHud.value = null
            }
        }
    }
}

private data class GatewayAgentSummary(val id: String, val name: String?)
