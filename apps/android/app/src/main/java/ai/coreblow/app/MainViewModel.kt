package ai.coreblow.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatPendingToolCall
import ai.coreblow.app.chat.ChatSessionEntry
import ai.coreblow.app.chat.OutgoingAttachment
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.node.handlers.CameraCaptureManager
import ai.coreblow.app.node.handlers.CanvasController
import ai.coreblow.app.voice.VoiceConversationEntry
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn

/**
 * Root ViewModel for CoreBlow — bridges the Compose UI to [NodeRuntime].
 *
 * Owns a lazy reference to NodeRuntime and projects every runtime
 * state-flow into the ViewModel scope so that the UI layer never
 * touches the runtime directly.  All mutations go through
 * single-responsibility methods that delegate to runtime or prefs.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModel(app: Application) : AndroidViewModel(app) {

    companion object {
        private const val TAG = "MainViewModel"
    }

    private val nodeApp = app as NodeApp
    private val prefs = nodeApp.prefs
    private val runtimeRef = MutableStateFlow<NodeRuntime?>(null)
    private var foreground = true

    // ── Runtime access ──────────────────────────────────────

    private fun ensureRuntime(): NodeRuntime {
        runtimeRef.value?.let { return it }
        val runtime = nodeApp.ensureRuntime()
        runtime.setForeground(foreground)
        runtimeRef.value = runtime
        Log.d(TAG, "Runtime attached to ViewModel")
        return runtime
    }

    /** Project a runtime [StateFlow] into the ViewModel scope. */
    private fun <T> runtimeState(
        initial: T,
        selector: (NodeRuntime) -> StateFlow<T>,
    ): StateFlow<T> =
        runtimeRef
            .flatMapLatest { runtime -> runtime?.let(selector) ?: flowOf(initial) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, initial)

    val runtimeInitialized: StateFlow<Boolean> =
        runtimeRef
            .flatMapLatest { flowOf(it != null) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    // ── Canvas state ────────────────────────────────────────

    val canvasCurrentUrl: StateFlow<String?> = runtimeState(null) { it.canvas.currentUrl }
    val canvasA2uiHydrated: StateFlow<Boolean> = runtimeState(false) { it.canvasA2uiHydrated }
    val canvasRehydratePending: StateFlow<Boolean> = runtimeState(false) { it.canvasRehydratePending }
    val canvasRehydrateErrorText: StateFlow<String?> = runtimeState(null) { it.canvasRehydrateErrorText }

    // ── Gateway / connection state ──────────────────────────

    val gateways: StateFlow<List<GatewayEndpoint>> = runtimeState(emptyList()) { it.gateways }
    val discoveryStatusText: StateFlow<String> = runtimeState("Searching…") { it.discoveryStatusText }
    val isConnected: StateFlow<Boolean> = runtimeState(false) { it.isConnected }
    val isNodeConnected: StateFlow<Boolean> = runtimeState(false) { it.nodeConnected }
    val statusText: StateFlow<String> = runtimeState("Offline") { it.statusText }
    val serverName: StateFlow<String?> = runtimeState(null) { it.serverName }
    val remoteAddress: StateFlow<String?> = runtimeState(null) { it.remoteAddress }
    val pendingGatewayTrust: StateFlow<NodeRuntime.GatewayTrustPrompt?> = runtimeState(null) { it.pendingGatewayTrust }
    val seamColorArgb: StateFlow<Long> = runtimeState(0xFF0EA5E9) { it.seamColorArgb }
    val mainSessionKey: StateFlow<String> = runtimeState("main") { it.mainSessionKey }

    // ── Camera state ────────────────────────────────────────

    val cameraHud: StateFlow<CameraHudState?> = runtimeState(null) { it.cameraHud }
    val cameraFlashToken: StateFlow<Long> = runtimeState(0L) { it.cameraFlashToken }

    // ── Preference-backed state ─────────────────────────────

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
    val canvasDebugStatusEnabled: StateFlow<Boolean> = prefs.canvasDebugStatusEnabled
    val speakerEnabled: StateFlow<Boolean> = prefs.speakerEnabled
    val micEnabled: StateFlow<Boolean> = prefs.talkEnabled

    // ── Mic / voice state ───────────────────────────────────

    val micCooldown: StateFlow<Boolean> = runtimeState(false) { it.micCooldown }
    val micStatusText: StateFlow<String> = runtimeState("Mic off") { it.micStatusText }
    val micLiveTranscript: StateFlow<String?> = runtimeState(null) { it.micLiveTranscript }
    val micIsListening: StateFlow<Boolean> = runtimeState(false) { it.micIsListening }
    val micQueuedMessages: StateFlow<List<String>> = runtimeState(emptyList()) { it.micQueuedMessages }
    val micConversation: StateFlow<List<VoiceConversationEntry>> = runtimeState(emptyList()) { it.micConversation }
    val micInputLevel: StateFlow<Float> = runtimeState(0f) { it.micInputLevel }
    val micIsSending: StateFlow<Boolean> = runtimeState(false) { it.micIsSending }

    // ── Chat state ──────────────────────────────────────────

    val chatSessionKey: StateFlow<String> = runtimeState("main") { it.chatSessionKey }
    val chatSessionId: StateFlow<String?> = runtimeState(null) { it.chatSessionId }
    val chatMessages: StateFlow<List<ChatMessage>> = runtimeState(emptyList()) { it.chatMessages }
    val chatError: StateFlow<String?> = runtimeState(null) { it.chatError }
    val chatHealthOk: StateFlow<Boolean> = runtimeState(false) { it.chatHealthOk }
    val chatThinkingLevel: StateFlow<String> = runtimeState("off") { it.chatThinkingLevel }
    val chatStreamingAssistantText: StateFlow<String?> = runtimeState(null) { it.chatStreamingAssistantText }
    val chatPendingToolCalls: StateFlow<List<ChatPendingToolCall>> = runtimeState(emptyList()) { it.chatPendingToolCalls }
    val chatSessions: StateFlow<List<ChatSessionEntry>> = runtimeState(emptyList()) { it.chatSessions }
    val pendingRunCount: StateFlow<Int> = runtimeState(0) { it.pendingRunCount }

    // ── Init ────────────────────────────────────────────────

    init {
        if (prefs.onboardingCompleted.value) {
            ensureRuntime()
        }
    }

    // ── Accessors for subsystems ────────────────────────────

    val canvas: CanvasController get() = ensureRuntime().canvas
    val camera: CameraCaptureManager get() = ensureRuntime().camera
    val sms: ai.coreblow.app.node.SmsManager get() = ensureRuntime().sms

    fun attachRuntimeUi(owner: LifecycleOwner, permissionRequester: PermissionRequester) {
        val runtime = runtimeRef.value ?: return
        runtime.camera.attachLifecycleOwner(owner)
        runtime.camera.attachPermissionRequester(permissionRequester)
        runtime.sms.attachPermissionRequester(permissionRequester)
    }

    // ── Lifecycle ───────────────────────────────────────────

    fun setForeground(value: Boolean) {
        foreground = value
        val runtime = if (value && prefs.onboardingCompleted.value) {
            ensureRuntime()
        } else {
            runtimeRef.value
        }
        runtime?.setForeground(value)
    }

    // ── Preference mutations ────────────────────────────────

    fun setDisplayName(value: String) { prefs.setDisplayName(value) }
    fun setCameraEnabled(value: Boolean) { prefs.setCameraEnabled(value) }
    fun setLocationMode(mode: LocationMode) { prefs.setLocationMode(mode) }
    fun setLocationPreciseEnabled(value: Boolean) { prefs.setLocationPreciseEnabled(value) }
    fun setPreventSleep(value: Boolean) { prefs.setPreventSleep(value) }
    fun setManualEnabled(value: Boolean) { prefs.setManualEnabled(value) }
    fun setManualHost(value: String) { prefs.setManualHost(value) }
    fun setManualPort(value: Int) { prefs.setManualPort(value) }
    fun setManualTls(value: Boolean) { prefs.setManualTls(value) }
    fun setGatewayToken(value: String) { prefs.setGatewayToken(value) }
    fun setGatewayBootstrapToken(value: String) { prefs.setGatewayBootstrapToken(value) }
    fun setGatewayPassword(value: String) { prefs.setGatewayPassword(value) }
    fun setCanvasDebugStatusEnabled(value: Boolean) { prefs.setCanvasDebugStatusEnabled(value) }

    fun setOnboardingCompleted(value: Boolean) {
        if (value) ensureRuntime()
        prefs.setOnboardingCompleted(value)
    }

    // ── Runtime actions ─────────────────────────────────────

    fun setVoiceScreenActive(active: Boolean) { ensureRuntime().setVoiceScreenActive(active) }
    fun setMicEnabled(enabled: Boolean) { ensureRuntime().setMicEnabled(enabled) }
    fun setSpeakerEnabled(enabled: Boolean) { ensureRuntime().setSpeakerEnabled(enabled) }

    fun refreshGatewayConnection() { ensureRuntime().refreshGatewayConnection() }
    fun connect(endpoint: GatewayEndpoint) { ensureRuntime().connect(endpoint) }
    fun connectManual() { ensureRuntime().connectManual() }
    fun disconnect() { runtimeRef.value?.disconnect() }

    fun acceptGatewayTrustPrompt() { runtimeRef.value?.acceptGatewayTrustPrompt() }
    fun declineGatewayTrustPrompt() { runtimeRef.value?.declineGatewayTrustPrompt() }

    fun handleCanvasA2UIActionFromWebView(payloadJson: String) {
        ensureRuntime().handleCanvasA2UIActionFromWebView(payloadJson)
    }

    fun isTrustedCanvasActionUrl(rawUrl: String?): Boolean {
        return ensureRuntime().isTrustedCanvasActionUrl(rawUrl)
    }

    fun requestCanvasRehydrate(source: String = "screen_tab") {
        ensureRuntime().requestCanvasRehydrate(source = source, force = true)
    }

    fun refreshHomeCanvasOverviewIfConnected() {
        ensureRuntime().refreshHomeCanvasOverviewIfConnected()
    }

    // ── Chat actions ────────────────────────────────────────

    fun loadChat(sessionKey: String) { ensureRuntime().loadChat(sessionKey) }
    fun refreshChat() { ensureRuntime().refreshChat() }
    fun refreshChatSessions(limit: Int? = null) { ensureRuntime().refreshChatSessions(limit = limit) }
    fun setChatThinkingLevel(level: String) { ensureRuntime().setChatThinkingLevel(level) }
    fun switchChatSession(sessionKey: String) { ensureRuntime().switchChatSession(sessionKey) }
    fun abortChat() { ensureRuntime().abortChat() }

    fun sendChat(message: String, thinking: String, attachments: List<OutgoingAttachment>) {
        ensureRuntime().sendChat(message = message, thinking = thinking, attachments = attachments)
    }
}
