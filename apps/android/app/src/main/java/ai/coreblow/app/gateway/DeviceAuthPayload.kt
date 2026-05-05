package ai.coreblow.app.gateway

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Represents the device authentication payload sent during the gateway handshake.
 *
 * Contains the device identity, auth token, and platform metadata
 * required by the gateway to authorize this node.
 */
data class DeviceAuthPayload(
    val deviceId: String,
    val authType: String,
    val token: String?,
    val displayName: String,
    val platform: String,
    val modelIdentifier: String,
    val appVersion: String,
) {
    /**
     * Serialize to JSON for the wire protocol.
     */
    fun toJson(): JsonObject = buildJsonObject {
        put("deviceId", deviceId)
        put("authType", authType)
        token?.let { put("token", it) }
        put("displayName", displayName)
        put("platform", platform)
        put("model", modelIdentifier)
        put("version", appVersion)
    }

    companion object {
        /**
         * Build a payload from identity and auth stores.
         */
        fun from(
            identity: DeviceIdentityStore,
            authStore: DeviceAuthStore,
            endpoint: GatewayEndpoint,
            appVersion: String,
        ): DeviceAuthPayload {
            val token = authStore.getToken(endpoint.stableId)
            val authType = if (token != null) CoreBlowProtocol.AUTH_DEVICE_TOKEN else CoreBlowProtocol.AUTH_BOOTSTRAP

            return DeviceAuthPayload(
                deviceId = identity.deviceId,
                authType = authType,
                token = token,
                displayName = identity.displayName,
                platform = identity.platformIdentifier,
                modelIdentifier = identity.modelIdentifier,
                appVersion = appVersion,
            )
        }
    }
}
