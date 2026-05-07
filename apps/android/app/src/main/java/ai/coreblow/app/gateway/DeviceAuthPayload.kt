package ai.coreblow.app.gateway

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.security.MessageDigest
import java.util.UUID

/**
 * Device authentication payload for gateway handshake.
 * Contains device identity, capabilities, and auth credentials.
 */
@Serializable
data class DeviceAuthPayload(
    val deviceId: String,
    val deviceName: String,
    val platform: String = "android",
    val osVersion: String = Build.VERSION.RELEASE,
    val sdkVersion: Int = Build.VERSION.SDK_INT,
    val manufacturer: String = Build.MANUFACTURER,
    val model: String = Build.MODEL,
    val appVersion: String = "1.0.0",
    val protocolVersion: String = CoreBlowProtocol.PROTOCOL_VERSION,
    val authMode: String = CoreBlowProtocol.AUTH_DEVICE_TOKEN,
    val token: String? = null,
    val capabilities: List<String> = emptyList(),
    val locale: String = java.util.Locale.getDefault().toLanguageTag(),
    val timezone: String = java.util.TimeZone.getDefault().id,
    val timestampMs: Long = System.currentTimeMillis(),
) {
    fun toJson(): String = buildJsonObject {
        put("deviceId", deviceId)
        put("deviceName", deviceName)
        put("platform", platform)
        put("osVersion", osVersion)
        put("sdkVersion", sdkVersion)
        put("manufacturer", manufacturer)
        put("model", model)
        put("appVersion", appVersion)
        put("protocolVersion", protocolVersion)
        put("authMode", authMode)
        token?.let { put("token", it) }
        put("capabilities", JsonArray(capabilities.map { JsonPrimitive(it) }))
        put("locale", locale)
        put("timezone", timezone)
        put("timestampMs", timestampMs)
    }.toString()

    companion object {
        fun create(context: Context, token: String? = null, capabilities: List<String> = emptyList()): DeviceAuthPayload {
            val deviceId = DeviceIdentityStore.getOrCreateDeviceId(context)
            return DeviceAuthPayload(
                deviceId = deviceId,
                deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
                token = token,
                capabilities = capabilities,
            )
        }
    }
}

/**
 * WebSocket connect options.
 */
data class ConnectOptions(
    val host: String,
    val port: Int = 18789,
    val useTls: Boolean = false,
    val authPayload: DeviceAuthPayload? = null,
    val autoReconnect: Boolean = true,
    val maxReconnectAttempts: Int = 10,
    val reconnectBaseDelayMs: Long = 2000,
    val keepaliveIntervalMs: Long = 25000,
    val connectionTimeoutMs: Long = 15000,
    val requestTimeoutMs: Long = 30000,
    val maxMessageSizeBytes: Int = 5 * 1024 * 1024,
    val headers: Map<String, String> = emptyMap(),
) {
    val wsUrl: String get() {
        val scheme = if (useTls) "wss" else "ws"
        return "$scheme://$host:$port/ws"
    }

    val httpBaseUrl: String get() {
        val scheme = if (useTls) "https" else "http"
        return "$scheme://$host:$port"
    }

    val healthUrl: String get() = "$httpBaseUrl/health"

    fun withAuth(token: String): ConnectOptions = copy(
        authPayload = authPayload?.copy(token = token) ?: DeviceAuthPayload(
            deviceId = "", deviceName = "", token = token,
        ),
    )
}

/**
 * TLS configuration parameters.
 */
data class TlsParams(
    val enabled: Boolean = false,
    val trustAllCerts: Boolean = false,
    val pinnedCertHash: String? = null,
    val clientCertPath: String? = null,
    val clientKeyPath: String? = null,
    val minTlsVersion: String = "TLSv1.2",
) {
    fun validate(): List<String> {
        val errors = mutableListOf<String>()
        if (trustAllCerts && pinnedCertHash != null) {
            errors.add("Cannot trust all certs and pin a cert simultaneously")
        }
        if (clientCertPath != null && clientKeyPath == null) {
            errors.add("Client key path required when client cert is provided")
        }
        if (minTlsVersion !in listOf("TLSv1.2", "TLSv1.3")) {
            errors.add("Unsupported TLS version: $minTlsVersion")
        }
        return errors
    }
}

/**
 * Auth response from gateway.
 */
data class AuthResponse(
    val isSuccess: Boolean,
    val sessionId: String? = null,
    val expiresAt: Long? = null,
    val scopes: List<String> = emptyList(),
    val errorCode: Int? = null,
    val errorMessage: String? = null,
    val serverName: String? = null,
    val serverVersion: String? = null,
) {
    companion object {
        fun fromJson(json: JsonObject): AuthResponse {
            val isSuccess = json["type"]?.jsonPrimitive?.contentOrNull == CoreBlowProtocol.MSG_AUTH_OK

            return AuthResponse(
                isSuccess = isSuccess,
                sessionId = json["sessionId"]?.jsonPrimitive?.contentOrNull,
                expiresAt = json["expiresAt"]?.jsonPrimitive?.longOrNull,
                scopes = json["scopes"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
                errorCode = json["error"]?.jsonObject?.get("code")?.jsonPrimitive?.intOrNull,
                errorMessage = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull,
                serverName = json["name"]?.jsonPrimitive?.contentOrNull,
                serverVersion = json["version"]?.jsonPrimitive?.contentOrNull,
            )
        }
    }

    val isExpired: Boolean get() = expiresAt != null && System.currentTimeMillis() > expiresAt
    val hasScope: (String) -> Boolean = { scope -> scope in scopes || "admin" in scopes }
}
