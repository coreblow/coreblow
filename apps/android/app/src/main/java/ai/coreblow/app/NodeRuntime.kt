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
    val sms = SmsManager(appContext)
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

    private val deviceHandler = DeviceHandler(
        appContext = appContext,
        smsEnabled = BuildConfig.COREBLOW_ENABLE_SMS,
        callLogEnabled = BuildConfig.COREBLOW_ENABLE_CALL_LOG,
    )
    private val notificationsHandler = NotificationsHandler(appContext = appContext)
    private val systemHandler = SystemHandler(appContext = appContext)
    private val photosHandler = PhotosHandler(appContext = appContext)
    private val contactsHandler = ContactsHandler(appContext = appContext)
    private val calendarHandler = CalendarHandler(appContext = appContext)
    private val callLogHandler = CallLogHandler(appContext = appContext)
    private val motionHandler = MotionHandler(appContext = appContext)
    private val smsHandlerImpl = SmsHandler(sms = sms)
    private val debugHandler = DebugHandler(appContext = appContext, identityStore = identityStore)
    private val a2uiHandler = A2UIHandler(
        canvas = canvas, json = json,
        getNodeCanvasHostUrl = { nodeSession.currentCanvasHostUrl() },
        getOperatorCanvasHostUrl = { operatorSession.currentCanvasHostUrl() },
    )

    private val connectionManager = ConnectionManager(
        prefs = prefs,
        cameraEnabled = { cameraEnabled.value },
        locationMode = { locationMode.value },
        voiceWakeMode = { VoiceWakeMode.Off },
        motionActivityAvailable = { motionHandler.isActivityAvailable() },
        motionPedometerAvailable = { motionHandler.isPedometerAvailable() },
        sendSmsAvailable = { BuildConfig.COREBLOW_ENABLE_SMS && sms.canSendSms() },
        readSmsAvailable = { BuildConfig.COREBLOW_ENABLE_SMS && sms.canReadSms() },
        callLogAvailable = { BuildConfig.COREBLOW_ENABLE_CALL_LOG },
        hasRecordAudioPermission = { hasRecordAudioPermission() },
        manualTls = { manualTls.value },
    )

    private val invokeDispatcher = InvokeDispatcher(
        canvas = canvas,
        cameraHandler = cameraHandler,
        locationHandler = locationHandler,
        deviceHandler = deviceHandler,
        notificationsHandler = notificationsHandler,
        systemHandler = systemHandler,
        photosHandler = photosHandler,
        contactsHandler = contactsHandler,
        calendarHandler = calendarHandler,
        motionHandler = motionHandler,
        smsHandler = smsHandlerImpl,
        a2uiHandler = a2uiHandler,
        debugHandler = debugHandler,
        callLogHandler = callLogHandler,
        isForeground = { _isForeground.value },
        cameraEnabled = { cameraEnabled.value },
        locationEnabled = { locationMode.value != LocationMode.Off },
        sendSmsAvailable = { BuildConfig.COREBLOW_ENABLE_SMS && sms.canSendSms() },
        readSmsAvailable = { BuildConfig.COREBLOW_ENABLE_SMS && sms.canReadSms() },
        callLogAvailable = { BuildConfig.COREBLOW_ENABLE_CALL_LOG },
        debugBuild = { BuildConfig.DEBUG },
        refreshNodeCanvasCapability = { nodeSession.refreshNodeCanvasCapability() },
        onCanvasA2uiPush = { _canvasA2uiHydrated.value = true; _canvasRehydratePending.value = false; _canvasRehydrateErrorText.value = null },
        onCanvasA2uiReset = { _canvasA2uiHydrated.value = false },
        motionActivityAvailable = { motionHandler.isActivityAvailable() },
        motionPedometerAvailable = { motionHandler.isPedometerAvailable() },
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

    init {
        DeviceNotificationListenerService.setNodeEventSink { event, payloadJson ->
            scope.launch { nodeSession.sendNodeEvent(event = event, payloadJson = payloadJson) }
        }
    }

    // MARK: - Chat & Voice

    private val chat = ChatController(
        scope = scope,
        session = operatorSession,
        json = json,
        supportsChatSubscribe = false,
    ).also { it.applyMainSessionKey(_mainSessionKey.value) }

    private val talkMode: TalkModeManager by lazy {
        TalkModeManager(
            context = appContext, scope = scope, session = operatorSession,
            supportsChatSubscribe = true, isConnected = { operatorConnected },
        )
    }

    private val voiceReplySpeakerLazy: Lazy<TalkModeManager> = lazy {
        TalkModeManager(
            context = appContext, scope = scope, session = operatorSession,
            supportsChatSubscribe = false, isConnected = { operatorConnected },
        ).also { it.setPlaybackEnabled(prefs.speakerEnabled.value) }
    }
    private val voiceReplySpeaker: TalkModeManager get() = voiceReplySpeakerLazy.value

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
    val micQueuedMessages: StateFlow<List<String>> get() = micCapture.queuedMessages
    val micConversation: StateFlow<List<VoiceConversationEntry>> get() = micCapture.conversation
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
        if (prefs.voiceWakeMode.value != VoiceWakeMode.Off) prefs.setVoiceWakeMode(VoiceWakeMode.Off)
        scope.launch { prefs.loadGatewayToken() }
        scope.launch {
            prefs.talkEnabled.collect { enabled ->
                micCapture.setMicEnabled(enabled)
                if (enabled) { talkMode.ttsOnAllResponses = true; scope.launch { talkMode.ensureChatSubscribed() } }
                externalAudioCaptureActive.value = enabled
            }
        }
        scope.launch(Dispatchers.Default) { gateways.collect { list -> seedLastDiscoveredGateway(list); autoConnectIfNeeded() } }
        scope.launch {
            combine(canvasDebugStatusEnabled, statusText, serverName, remoteAddress) { debug, status, server, remote -> Quad(debug, status, server, remote) }
                .distinctUntilChanged().collect { (debugEnabled, status, server, remote) ->
                    canvas.setDebugStatusEnabled(debugEnabled)
                    if (debugEnabled) canvas.setDebugStatus(status, server ?: remote)
                }
        }
        updateHomeCanvasState()
        showLocalCanvasOnConnect()
    }

    private fun showLocalCanvasOnConnect() {
        _canvasA2uiHydrated.value = false
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = null
        canvas.navigate("")
    }

    private fun showLocalCanvasOnDisconnect() {
        _canvasA2uiHydrated.value = false
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = null
        canvas.navigate("")
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
        if (voiceReplySpeakerLazy.isInitialized()) voiceReplySpeaker.setPlaybackEnabled(value)
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

    private fun triggerCameraFlash() { _cameraFlashToken.value = SystemClock.elapsedRealtimeNanos() }

    private fun showCameraHud(message: String, kind: CameraHudKind, autoHideMs: Long? = null) {
        val token = cameraHudSeq.incrementAndGet()
        _cameraHud.value = CameraHudState(token = token, kind = kind, message = message)
        if (autoHideMs != null && autoHideMs > 0) {
            scope.launch { delay(autoHideMs); if (_cameraHud.value?.token == token) _cameraHud.value = null }
        }
    }

    // MARK: - Canvas Rehydrate

    fun requestCanvasRehydrate(source: String = "manual", force: Boolean = true) {
        scope.launch {
            if (!_nodeConnected.value) { _canvasRehydratePending.value = false; _canvasRehydrateErrorText.value = "Node offline. Reconnect and retry."; return@launch }
            if (!force && didAutoRequestCanvasRehydrate) return@launch
            didAutoRequestCanvasRehydrate = true
            val requestId = canvasRehydrateSeq.incrementAndGet()
            _canvasRehydratePending.value = true; _canvasRehydrateErrorText.value = null
            val sessionKey = resolveMainSessionKey()
            val sent = nodeSession.sendNodeEvent("agent.request", buildJsonObject {
                put("message", JsonPrimitive("Restore canvas now for session=$sessionKey source=$source."))
                put("sessionKey", JsonPrimitive(sessionKey)); put("thinking", JsonPrimitive("low")); put("deliver", JsonPrimitive(false))
            }.toString())
            if (!sent) { if (!force) didAutoRequestCanvasRehydrate = false; if (canvasRehydrateSeq.get() == requestId) { _canvasRehydratePending.value = false; _canvasRehydrateErrorText.value = "Failed to request restore. Tap to retry." }; return@launch }
            scope.launch { delay(20_000); if (canvasRehydrateSeq.get() == requestId && _canvasRehydratePending.value && !_canvasA2uiHydrated.value) { _canvasRehydratePending.value = false; _canvasRehydrateErrorText.value = "No canvas update yet. Tap to retry." } }
        }
    }

    fun refreshHomeCanvasOverviewIfConnected() {
        if (!operatorConnected) { updateHomeCanvasState(); return }
        scope.launch { refreshBrandingFromGateway(); refreshAgentsFromGateway() }
    }

    fun handleCanvasA2UIActionFromWebView(payloadJson: String) {
        scope.launch {
            val trimmed = payloadJson.trim(); if (trimmed.isEmpty()) return@launch
            val root = try { json.parseToJsonElement(trimmed) as? JsonObject ?: return@launch } catch (_: Throwable) { return@launch }
            val userActionObj = (root["userAction"] as? JsonObject) ?: root
            val actionId = (userActionObj["id"] as? JsonPrimitive)?.content?.trim().orEmpty().ifEmpty { UUID.randomUUID().toString() }
            val name = (userActionObj["name"] as? JsonPrimitive)?.content?.trim() ?: return@launch
            val sessionKey = resolveMainSessionKey()
            val connected = _nodeConnected.value
            var error: String? = null
            if (connected) {
                val sent = nodeSession.sendNodeEvent("agent.request", buildJsonObject {
                    put("message", JsonPrimitive("Canvas action: $name session=$sessionKey"))
                    put("sessionKey", JsonPrimitive(sessionKey)); put("thinking", JsonPrimitive("low")); put("deliver", JsonPrimitive(false)); put("key", JsonPrimitive(actionId))
                }.toString())
                if (!sent) error = "send failed"
            } else error = "gateway not connected"
        }
    }

    fun isTrustedCanvasActionUrl(rawUrl: String?): Boolean = a2uiHandler.isTrustedCanvasActionUrl(rawUrl)

    // MARK: - Home Canvas State

    private fun updateHomeCanvasState() {
        val payload = try { json.encodeToString(makeHomeCanvasPayload()) } catch (_: Throwable) { null }
        canvas.updateHomeCanvasState(payload)
    }

    private fun makeHomeCanvasPayload(): HomeCanvasPayload {
        val state = resolveHomeCanvasGatewayState()
        val gatewayName = _serverName.value?.trim()?.takeIf { it.isNotEmpty() }
        val gatewayAddress = _remoteAddress.value?.trim()?.takeIf { it.isNotEmpty() }
        val gatewayLabel = gatewayName ?: gatewayAddress ?: "Gateway"
        val activeAgentId = resolveActiveAgentId()
        val agents = homeCanvasAgents(activeAgentId)
        return when (state) {
            HomeCanvasGatewayState.Connected -> HomeCanvasPayload(gatewayState = "connected", eyebrow = "Connected to $gatewayLabel", title = "Your agents are ready",
                subtitle = "This phone stays dormant until the gateway needs it.", gatewayLabel = gatewayLabel,
                activeAgentName = resolveActiveAgentName(activeAgentId), activeAgentBadge = agents.firstOrNull { it.isActive }?.badge ?: "CB",
                activeAgentCaption = "Selected on this phone", agentCount = agents.size, agents = agents.take(6), footer = "Overview refreshes on reconnect.")
            else -> HomeCanvasPayload(gatewayState = if (state == HomeCanvasGatewayState.Error) "error" else "offline", eyebrow = "Welcome to CoreBlow",
                title = "Your phone stays quiet until needed", subtitle = "Pair this device to your gateway.",
                gatewayLabel = gatewayLabel, activeAgentName = "Main", activeAgentBadge = "CB", activeAgentCaption = "Connect to load agents",
                agentCount = agents.size, agents = agents.take(4), footer = "The gateway wakes the phone with silent push.")
        }
    }

    private fun resolveHomeCanvasGatewayState(): HomeCanvasGatewayState {
        val lower = _statusText.value.trim().lowercase()
        return when {
            _isConnected.value -> HomeCanvasGatewayState.Connected
            lower.contains("connecting") || lower.contains("reconnecting") -> HomeCanvasGatewayState.Connecting
            lower.contains("error") || lower.contains("failed") -> HomeCanvasGatewayState.Error
            else -> HomeCanvasGatewayState.Offline
        }
    }

    private fun resolveActiveAgentId(): String {
        val mainKey = _mainSessionKey.value.trim()
        if (mainKey.startsWith("agent:")) { val agentId = mainKey.removePrefix("agent:").substringBefore(':').trim(); if (agentId.isNotEmpty()) return agentId }
        return gatewayDefaultAgentId?.trim().orEmpty()
    }

    private fun resolveActiveAgentName(activeAgentId: String): String {
        if (activeAgentId.isNotEmpty()) gatewayAgents.firstOrNull { it.id == activeAgentId }?.let { return it.name ?: it.id }
        return gatewayAgents.firstOrNull()?.let { it.name ?: it.id } ?: "Main"
    }

    private fun homeCanvasAgents(activeAgentId: String): List<HomeCanvasAgentCard> {
        val defaultId = gatewayDefaultAgentId?.trim().orEmpty()
        return gatewayAgents.map { agent ->
            val isActive = activeAgentId.isNotEmpty() && agent.id == activeAgentId
            val isDefault = defaultId.isNotEmpty() && agent.id == defaultId
            HomeCanvasAgentCard(
                id = agent.id,
                name = normalized(agent.name) ?: agent.id,
                badge = homeCanvasBadge(agent),
                caption = when { isActive -> "Active on this phone"; isDefault -> "Default agent"; else -> "Ready" },
                isActive = isActive,
            )
        }.sortedWith(compareByDescending<HomeCanvasAgentCard> { it.isActive }.thenBy { it.name.lowercase() })
    }

    private fun homeCanvasBadge(agent: GatewayAgentSummary): String {
        val emoji = normalized(agent.emoji)
        if (emoji != null) return emoji
        val initials = (normalized(agent.name) ?: agent.id)
            .split(' ', '-', '_')
            .filter { it.isNotBlank() }
            .take(2)
            .mapNotNull { token -> token.firstOrNull()?.uppercaseChar()?.toString() }
            .joinToString("")
        return if (initials.isNotEmpty()) initials else "CB"
    }

    private fun normalized(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        return trimmed.ifEmpty { null }
    }

    // ── Runtime diagnostics (OC parity) ─────────────────

    fun diagnosticSnapshot(): RuntimeDiagnosticSnapshot = RuntimeDiagnosticSnapshot(
        isConnected = _isConnected.value,
        nodeConnected = _nodeConnected.value,
        statusText = _statusText.value,
        serverName = _serverName.value,
        remoteAddress = _remoteAddress.value,
        mainSessionKey = _mainSessionKey.value,
        connectedEndpointHost = connectedEndpoint?.host,
        connectedEndpointPort = connectedEndpoint?.port,
        operatorSessionDiag = operatorSession.connectionDiagnosticSnapshot(),
        nodeSessionDiag = nodeSession.connectionDiagnosticSnapshot(),
        discoveredGateways = gateways.value.size,
        canvasA2uiHydrated = _canvasA2uiHydrated.value,
        canvasRehydratePending = _canvasRehydratePending.value,
        isForeground = _isForeground.value,
        cameraEnabled = cameraEnabled.value,
        micEnabled = micEnabled.value,
        speakerEnabled = speakerEnabled.value,
        locationMode = locationMode.value.name,
        preventSleep = preventSleep.value,
        manualEnabled = manualEnabled.value,
        onboardingCompleted = onboardingCompleted.value,
    )

    fun registeredHandlerNames(): List<String> = listOf(
        "camera", "location", "device", "notifications", "system", "photos",
        "contacts", "calendar", "callLog", "motion", "sms", "debug", "a2ui",
    )

    fun registeredHandlerCount(): Int = registeredHandlerNames().size

    fun activeCapabilities(): Map<String, Boolean> = mapOf(
        "camera" to cameraEnabled.value,
        "location" to (locationMode.value != LocationMode.Off),
        "sms.send" to (BuildConfig.COREBLOW_ENABLE_SMS && sms.canSendSms()),
        "sms.read" to (BuildConfig.COREBLOW_ENABLE_SMS && sms.canReadSms()),
        "callLog" to BuildConfig.COREBLOW_ENABLE_CALL_LOG,
        "microphone" to hasRecordAudioPermission(),
        "notifications" to notificationsHandler.isServiceEnabled(),
        "motion.activity" to motionHandler.isActivityAvailable(),
        "motion.pedometer" to motionHandler.isPedometerAvailable(),
    )

    fun sessionSnapshot(): SessionSnapshot = SessionSnapshot(
        operatorConnected = operatorConnected,
        nodeConnected = _nodeConnected.value,
        mainSessionKey = _mainSessionKey.value,
        chatSessionKey = chatSessionKey.value,
        chatSessionId = chatSessionId.value,
        chatMessageCount = chatMessages.value.size,
        chatHealthOk = chatHealthOk.value,
        pendingRunCount = pendingRunCount.value,
        gatewayDefaultAgentId = gatewayDefaultAgentId,
        gatewayAgentCount = gatewayAgents.size,
        canvasHostUrl = operatorSession.currentCanvasHostUrl(),
    )

    fun connectionUptime(): Long? {
        if (!_isConnected.value) return null
        return SystemClock.elapsedRealtime()
    }

    fun operatorSessionKey(): String? = operatorSession.currentMainSessionKey()

    fun nodeSessionKey(): String? = nodeSession.currentMainSessionKey()

    // ── Version & build info (OC parity) ────────────────

    fun versionString(): String = BuildConfig.VERSION_NAME
    fun versionCode(): Int = BuildConfig.VERSION_CODE
    fun buildType(): String = BuildConfig.BUILD_TYPE

    fun deviceIdentity(): Map<String, String> {
        val identity = identityStore.loadOrCreate()
        return mapOf(
            "deviceId" to identity.deviceId,
            "displayName" to displayName.value,
            "instanceId" to instanceId.value,
        )
    }

    // ── Discovery controls (OC parity) ──────────────────

    fun startDiscovery() = discovery.start()
    fun stopDiscovery() = discovery.stop()
    fun isDiscoveryActive(): Boolean = discovery.isActive()
    fun discoveredGatewayCount(): Int = gateways.value.size

    // ── Gateway agent helpers (OC parity) ───────────────

    fun switchAgent(agentId: String) {
        syncMainSessionKey(agentId.trim().takeIf { it.isNotEmpty() })
    }

    fun currentAgentId(): String = resolveActiveAgentId()
    fun currentAgentName(): String = resolveActiveAgentName(resolveActiveAgentId())

    fun listAgents(): List<Map<String, String?>> = gatewayAgents.map { agent ->
        mapOf("id" to agent.id, "name" to agent.name, "emoji" to agent.emoji)
    }

    // ── Canvas state (OC parity) ────────────────────────

    fun canvasUrl(): String? = operatorSession.currentCanvasHostUrl()
    fun nodeCanvasUrl(): String? = nodeSession.currentCanvasHostUrl()
    fun isCanvasHydrated(): Boolean = _canvasA2uiHydrated.value
    fun isCanvasRehydratePending(): Boolean = _canvasRehydratePending.value
    fun canvasRehydrateError(): String? = _canvasRehydrateErrorText.value

    // ── Voice state (OC parity) ─────────────────────────

    fun isMicEnabled(): Boolean = micEnabled.value
    fun isSpeakerEnabled(): Boolean = speakerEnabled.value
    fun micStatus(): String = micStatusText.value
    fun isMicListening(): Boolean = micIsListening.value
    fun isMicSending(): Boolean = micIsSending.value
    fun voiceConversationCount(): Int = micConversation.value.size
}

private data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

private enum class HomeCanvasGatewayState { Connected, Connecting, Error, Offline }

private data class GatewayAgentSummary(val id: String, val name: String?, val emoji: String? = null)

@Serializable
private data class HomeCanvasPayload(
    val gatewayState: String, val eyebrow: String, val title: String, val subtitle: String,
    val gatewayLabel: String, val activeAgentName: String, val activeAgentBadge: String,
    val activeAgentCaption: String, val agentCount: Int, val agents: List<HomeCanvasAgentCard>, val footer: String,
)

@Serializable
private data class HomeCanvasAgentCard(
    val id: String, val name: String, val badge: String, val caption: String, val isActive: Boolean,
)

// ── Diagnostic data classes (OC parity) ─────────────────

data class RuntimeDiagnosticSnapshot(
    val isConnected: Boolean,
    val nodeConnected: Boolean,
    val statusText: String,
    val serverName: String?,
    val remoteAddress: String?,
    val mainSessionKey: String,
    val connectedEndpointHost: String?,
    val connectedEndpointPort: Int?,
    val operatorSessionDiag: Map<String, Any?>,
    val nodeSessionDiag: Map<String, Any?>,
    val discoveredGateways: Int,
    val canvasA2uiHydrated: Boolean,
    val canvasRehydratePending: Boolean,
    val isForeground: Boolean,
    val cameraEnabled: Boolean,
    val micEnabled: Boolean,
    val speakerEnabled: Boolean,
    val locationMode: String,
    val preventSleep: Boolean,
    val manualEnabled: Boolean,
    val onboardingCompleted: Boolean,
)

data class SessionSnapshot(
    val operatorConnected: Boolean,
    val nodeConnected: Boolean,
    val mainSessionKey: String,
    val chatSessionKey: String,
    val chatSessionId: String?,
    val chatMessageCount: Int,
    val chatHealthOk: Boolean,
    val pendingRunCount: Int,
    val gatewayDefaultAgentId: String?,
    val gatewayAgentCount: Int,
    val canvasHostUrl: String?,
)

// ── Session key helpers (OC parity) ─────────────────────

internal fun buildNodeMainSessionKey(deviceId: String, agentId: String?): String {
    val normalizedAgent = agentId?.trim()?.takeIf { it.isNotEmpty() }
    return if (normalizedAgent != null) "agent:$normalizedAgent:device:$deviceId"
    else "device:$deviceId"
}

internal fun resolveAgentIdFromMainSessionKey(key: String?): String? {
    val trimmed = key?.trim().orEmpty()
    if (!trimmed.startsWith("agent:")) return null
    return trimmed.removePrefix("agent:").substringBefore(':').takeIf { it.isNotEmpty() }
}

internal fun parseHexColorArgb(hex: String?): Long? {
    val trimmed = hex?.trim().orEmpty().removePrefix("#")
    if (trimmed.isEmpty()) return null
    return try {
        val argb = when (trimmed.length) {
            6 -> "FF$trimmed"
            8 -> trimmed
            else -> return null
        }
        argb.toLong(16)
    } catch (_: NumberFormatException) { null }
}

internal const val DEFAULT_SEAM_COLOR_ARGB = 0xFF1A1A2EL
