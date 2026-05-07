package ai.coreblow.app.di

import android.content.Context
import android.util.Log
import ai.coreblow.app.gateway.*
import ai.coreblow.app.node.*
import ai.coreblow.app.node.handlers.*
import ai.coreblow.app.voice.*
import ai.coreblow.app.worker.HealthCheckWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Manual dependency injection module for CoreBlow Android.
 * Provides singleton instances of core services, handlers,
 * and gateway components. In production, this would be
 * replaced with Hilt/Dagger @Module annotations.
 */
object AppModule {

    private const val TAG = "AppModule"
    private var initialized = false

    // Scopes
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Singletons (lazy)
    private var _context: Context? = null
    val context: Context get() = _context ?: throw IllegalStateException("AppModule not initialized")

    // Gateway
    private var _deviceAuthStore: DeviceAuthStore? = null
    val deviceAuthStore: DeviceAuthStore get() = _deviceAuthStore ?: throw IllegalStateException("AppModule not initialized")

    private var _deviceIdentityStore: DeviceIdentityStore = DeviceIdentityStore

    private var _gatewayProtocol: GatewayProtocol? = null
    val gatewayProtocol: GatewayProtocol get() = _gatewayProtocol ?: throw IllegalStateException("AppModule not initialized")

    private var _invokeErrorParser: InvokeErrorParser? = null
    val invokeErrorParser: InvokeErrorParser get() = _invokeErrorParser ?: InvokeErrorParser().also { _invokeErrorParser = it }

    // Node handlers
    private var _systemHandler: SystemHandler? = null
    val systemHandler: SystemHandler get() = _systemHandler ?: throw IllegalStateException("AppModule not initialized")

    private var _debugHandler: DebugHandler? = null
    val debugHandler: DebugHandler get() = _debugHandler ?: throw IllegalStateException("AppModule not initialized")

    private var _notificationsHandler: NotificationsHandler? = null
    val notificationsHandler: NotificationsHandler get() = _notificationsHandler ?: throw IllegalStateException("AppModule not initialized")

    private var _contactsHandler: ContactsHandler? = null
    val contactsHandler: ContactsHandler get() = _contactsHandler ?: throw IllegalStateException("AppModule not initialized")

    private var _calendarHandler: CalendarHandler? = null
    val calendarHandler: CalendarHandler get() = _calendarHandler ?: throw IllegalStateException("AppModule not initialized")

    private var _cameraCaptureManager: CameraCaptureManager? = null
    val cameraCaptureManager: CameraCaptureManager get() = _cameraCaptureManager ?: throw IllegalStateException("AppModule not initialized")

    private var _canvasActionTrust: CanvasActionTrust? = null
    val canvasActionTrust: CanvasActionTrust get() = _canvasActionTrust ?: CanvasActionTrust().also { _canvasActionTrust = it }

    // Voice
    private var _voiceWakePreferences: VoiceWakePreferences? = null
    val voiceWakePreferences: VoiceWakePreferences get() = _voiceWakePreferences ?: throw IllegalStateException("AppModule not initialized")

    private var _voiceWakeCommandExtractor: VoiceWakeCommandExtractor? = null
    val voiceWakeCommandExtractor: VoiceWakeCommandExtractor get() = _voiceWakeCommandExtractor ?: VoiceWakeCommandExtractor().also { _voiceWakeCommandExtractor = it }

    private var _talkDirectiveParser: TalkDirectiveParser? = null
    val talkDirectiveParser: TalkDirectiveParser get() = _talkDirectiveParser ?: TalkDirectiveParser().also { _talkDirectiveParser = it }

    /**
     * Initialize the DI graph with the application context.
     * Must be called from Application.onCreate().
     */
    fun initialize(appContext: Context) {
        if (initialized) {
            Log.w(TAG, "AppModule already initialized")
            return
        }

        _context = appContext.applicationContext
        val ctx = _context!!

        // Gateway layer
        _deviceAuthStore = DeviceAuthStore(ctx)
        _gatewayProtocol = GatewayProtocol(ctx, appScope)

        // Node handlers
        _systemHandler = SystemHandler(ctx)
        _debugHandler = DebugHandler(ctx)
        _notificationsHandler = NotificationsHandler(ctx)
        _contactsHandler = ContactsHandler(ctx)
        _calendarHandler = CalendarHandler(ctx)
        _cameraCaptureManager = CameraCaptureManager(ctx)

        // Voice
        _voiceWakePreferences = VoiceWakePreferences(ctx)

        initialized = true
        Log.i(TAG, "AppModule initialized (${componentCount()} components)")
    }

    /**
     * Get all registered component names for diagnostics.
     */
    fun getComponentNames(): List<String> = listOf(
        "DeviceAuthStore", "DeviceIdentityStore", "GatewayProtocol",
        "InvokeErrorParser", "SystemHandler", "DebugHandler",
        "NotificationsHandler", "ContactsHandler", "CalendarHandler",
        "CameraCaptureManager", "CanvasActionTrust",
        "VoiceWakePreferences", "VoiceWakeCommandExtractor", "TalkDirectiveParser",
    )

    fun componentCount(): Int = getComponentNames().size

    /**
     * Check if all components are healthy.
     */
    fun healthCheck(): Map<String, Boolean> {
        return mapOf(
            "initialized" to initialized,
            "context" to (_context != null),
            "authStore" to (_deviceAuthStore != null),
            "gatewayProtocol" to (_gatewayProtocol != null),
            "systemHandler" to (_systemHandler != null),
            "voicePrefs" to (_voiceWakePreferences != null),
        )
    }

    /**
     * Release all resources.
     */
    fun release() {
        _cameraCaptureManager = null
        _gatewayProtocol = null
        initialized = false
        Log.i(TAG, "AppModule released")
    }

    /**
     * Provide ConnectOptions from saved state.
     */
    fun createConnectOptions(): ConnectOptions {
        val store = deviceAuthStore
        return ConnectOptions(
            host = store.lastHost ?: "localhost",
            port = store.lastPort,
            useTls = store.lastTls,
            authPayload = DeviceAuthPayload.create(context),
        )
    }

    /**
     * Schedule background workers.
     */
    fun scheduleWorkers() {
        val host = deviceAuthStore.lastHost ?: return
        HealthCheckWorker.schedule(context, host, deviceAuthStore.lastPort, deviceAuthStore.lastTls)
        Log.i(TAG, "Background workers scheduled")
    }
}
