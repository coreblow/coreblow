package ai.coreblow.app.node

import android.content.Context
import android.util.Log
import ai.coreblow.app.BuildConfig
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.gateway.DeviceAuthStore
import ai.coreblow.app.gateway.DeviceIdentityStore
import ai.coreblow.app.gateway.GatewayConnectOptions
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.gateway.GatewaySession
import ai.coreblow.app.gateway.GatewaySessionListener
import ai.coreblow.app.gateway.InvokeError
import ai.coreblow.app.node.handlers.CalendarHandler
import ai.coreblow.app.node.handlers.CameraHandler
import ai.coreblow.app.node.handlers.ContactsHandler
import ai.coreblow.app.node.handlers.DebugHandler
import ai.coreblow.app.node.handlers.DeviceHandler
import ai.coreblow.app.node.handlers.LocationHandler
import ai.coreblow.app.node.handlers.MotionHandler
import ai.coreblow.app.node.handlers.NotificationsHandler
import ai.coreblow.app.node.handlers.PhotosHandler
import ai.coreblow.app.node.handlers.SmsHandler
import ai.coreblow.app.node.handlers.SystemHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonObject

/**
 * Orchestrates the connection between the Android node and a CoreBlow gateway.
 *
 * Manages session lifecycle, handler registration, capability negotiation,
 * and exposes connection state via StateFlow for the UI layer.
 */
class ConnectionManager(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    companion object {
        private const val TAG = "ConnectionManager"
    }

    private val authStore = DeviceAuthStore(context)
    private val identityStore = DeviceIdentityStore(context)

    private val _connectionState = MutableStateFlow(GatewayConnectionState.DISCONNECTED)
    val connectionState: StateFlow<GatewayConnectionState> = _connectionState.asStateFlow()

    private val _connectedEndpoint = MutableStateFlow<GatewayEndpoint?>(null)
    val connectedEndpoint: StateFlow<GatewayEndpoint?> = _connectedEndpoint.asStateFlow()

    private var session: GatewaySession? = null
    private var dispatcher: InvokeDispatcher? = null

    /** Current runtime permission flags. Updated by the UI before connecting. */
    var runtimeFlags = NodeRuntimeFlags()

    /**
     * Connect to a gateway endpoint.
     */
    fun connect(endpoint: GatewayEndpoint) {
        disconnect()

        val sessionListener = object : GatewaySessionListener {
            override fun onStateChanged(state: GatewayConnectionState) {
                _connectionState.value = state
                if (state == GatewayConnectionState.CONNECTED) {
                    _connectedEndpoint.value = endpoint
                } else if (state == GatewayConnectionState.DISCONNECTED) {
                    _connectedEndpoint.value = null
                }
            }

            override fun onInvokeRequest(requestId: String, command: String, params: JsonObject) {
                dispatcher?.dispatch(requestId, command, params)
            }

            override fun onEvent(eventType: String, payload: JsonObject) {
                Log.d(TAG, "Gateway event: $eventType")
            }

            override fun onError(error: InvokeError) {
                Log.e(TAG, "Gateway error: ${error.code} — ${error.message}")
            }
        }

        val gatewaySession = GatewaySession(scope, sessionListener)
        session = gatewaySession

        val invokeDispatcher = InvokeDispatcher(scope, gatewaySession)
        registerHandlers(invokeDispatcher)
        dispatcher = invokeDispatcher

        val appVersion = try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
        } catch (_: Exception) {
            "1.0.0"
        }

        val capabilities = InvokeCommandRegistry.availableCapabilities(runtimeFlags)
        val commands = InvokeCommandRegistry.availableCommands(runtimeFlags)
        val clientInfo = identityStore.toClientInfo(appVersion)

        val options = GatewayConnectOptions(
            role = CoreBlowProtocol.ROLE_NODE,
            scopes = listOf("invoke", "event"),
            capabilities = capabilities,
            commands = commands,
            permissions = buildPermissionsMap(),
            client = clientInfo,
        )

        val token = authStore.getToken(endpoint.stableId)
        gatewaySession.connect(endpoint, options, token)

        Log.i(TAG, "Connecting to ${endpoint.label} with ${capabilities.size} caps, ${commands.size} commands")
    }

    /**
     * Disconnect from the current gateway.
     */
    fun disconnect() {
        session?.disconnect()
        session = null
        dispatcher = null
        _connectedEndpoint.value = null
    }

    /**
     * Store auth token after successful pairing.
     */
    fun storeAuthToken(endpoint: GatewayEndpoint, token: String) {
        authStore.storeToken(endpoint.stableId, token)
    }

    /**
     * Remove auth token and unpair from a gateway.
     */
    fun unpair(endpoint: GatewayEndpoint) {
        authStore.deleteToken(endpoint.stableId)
        if (_connectedEndpoint.value?.stableId == endpoint.stableId) {
            disconnect()
        }
    }

    private fun registerHandlers(dispatcher: InvokeDispatcher) {
        dispatcher.register(DeviceHandler(context))
        dispatcher.register(SystemHandler(context))
        dispatcher.register(ContactsHandler(context))
        dispatcher.register(CalendarHandler(context))
        dispatcher.register(PhotosHandler(context))
        dispatcher.register(CameraHandler(context))
        dispatcher.register(LocationHandler(context))
        dispatcher.register(SmsHandler(context))
        dispatcher.register(MotionHandler(context))
        dispatcher.register(NotificationsHandler(context))
        dispatcher.register(DebugHandler())
    }

    private fun buildPermissionsMap(): Map<String, Boolean> {
        return mapOf(
            "camera" to runtimeFlags.cameraEnabled,
            "location" to runtimeFlags.locationEnabled,
            "sms-send" to runtimeFlags.sendSmsAvailable,
            "sms-read" to runtimeFlags.readSmsAvailable,
            "call-log" to runtimeFlags.callLogAvailable,
            "motion" to (runtimeFlags.motionActivityAvailable || runtimeFlags.motionPedometerAvailable),
            "notifications" to runtimeFlags.notificationsAvailable,
        )
    }
}
