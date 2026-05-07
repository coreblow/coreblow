package ai.coreblow.app.gateway

import android.os.Build
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Device authentication payload sent during gateway handshake.
 * Contains device identity, capabilities, and auth credentials
 * needed for the hello/auth exchange.
 */
data class DeviceAuthPayload(
    val deviceId: String,
    val instanceId: String?,
    val displayName: String,
    val platform: String = "android",
    val version: String = "1.0.0",
    val sdkInt: Int = Build.VERSION.SDK_INT,
    val model: String = Build.MODEL,
    val manufacturer: String = Build.MANUFACTURER,
    val authType: String = CoreBlowProtocol.AUTH_DEVICE_TOKEN,
    val token: String? = null,
    val capabilities: List<String> = CoreBlowProtocol.ALL_CAPABILITIES,
    val scopes: List<String> = CoreBlowProtocol.ALL_SCOPES,
    val role: String = CoreBlowProtocol.ROLE_NODE,
) {
    fun toJson(): String = buildJsonObject {
        put("deviceId", JsonPrimitive(deviceId))
        instanceId?.let { put("instanceId", JsonPrimitive(it)) }
        put("displayName", JsonPrimitive(displayName))
        put("platform", JsonPrimitive(platform))
        put("version", JsonPrimitive(version))
        put("sdkInt", JsonPrimitive(sdkInt))
        put("model", JsonPrimitive(model))
        put("manufacturer", JsonPrimitive(manufacturer))
        put("authType", JsonPrimitive(authType))
        token?.let { put("token", JsonPrimitive(it)) }
        put("capabilities", JsonPrimitive(capabilities.joinToString(",")))
        put("scopes", JsonPrimitive(scopes.joinToString(",")))
        put("role", JsonPrimitive(role))
        put("protocolVersion", JsonPrimitive(CoreBlowProtocol.PROTOCOL_VERSION))
    }.toString()

    companion object {
        fun fromDeviceIdentity(
            deviceId: String,
            instanceId: String?,
            displayName: String,
            token: String?,
            capabilities: List<String> = CoreBlowProtocol.ALL_CAPABILITIES,
        ): DeviceAuthPayload {
            return DeviceAuthPayload(
                deviceId = deviceId,
                instanceId = instanceId,
                displayName = displayName,
                token = token,
                capabilities = capabilities,
            )
        }
    }
}

/**
 * Gateway connection options.
 */
data class GatewayConnectOptions(
    val role: String = CoreBlowProtocol.ROLE_NODE,
    val scopes: List<String> = CoreBlowProtocol.ALL_SCOPES,
    val capabilities: List<String> = CoreBlowProtocol.ALL_CAPABILITIES,
    val commands: List<String> = emptyList(),
    val permissions: Map<String, Boolean> = emptyMap(),
    val client: GatewayClientInfo? = null,
)

/**
 * Client info sent during gateway handshake.
 */
data class GatewayClientInfo(
    val id: String,
    val displayName: String,
    val version: String,
    val platform: String = "android",
    val mode: String = "node",
    val instanceId: String? = null,
    val deviceFamily: String? = null,
    val modelIdentifier: String? = null,
)

/**
 * TLS parameters for gateway connections.
 */
data class GatewayTlsParams(
    val required: Boolean = false,
    val fingerprint: String? = null,
    val trustOnFirstUse: Boolean = false,
    val allowSelfSigned: Boolean = false,
)
