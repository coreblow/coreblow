package ai.coreblow.app.gateway

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.json.*

/**
 * Encrypted persistent store for gateway authentication tokens,
 * session credentials, and connection history. Uses AES256-GCM
 * via EncryptedSharedPreferences.
 */
class DeviceAuthStore(context: Context) {

    companion object {
        private const val TAG = "DeviceAuthStore"
        private const val PREFS_NAME = "coreblow_device_auth"

        // Keys
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_SESSION_ID = "session_id"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_SCOPES = "scopes"
        private const val KEY_LAST_AUTH_MS = "last_auth_ms"
        private const val KEY_AUTH_ATTEMPTS = "auth_attempts"
        private const val KEY_LAST_HOST = "last_host"
        private const val KEY_LAST_PORT = "last_port"
        private const val KEY_LAST_TLS = "last_tls"
        private const val KEY_CONNECTION_HISTORY = "connection_history"
        private const val KEY_SERVER_VERSION = "server_version"
        private const val KEY_SERVER_NAME = "server_name"
        private const val MAX_HISTORY = 10
    }

    private val prefs = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (e: Exception) {
        Log.e(TAG, "Failed to create encrypted prefs: ${e.message}")
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Token management
    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var sessionId: String?
        get() = prefs.getString(KEY_SESSION_ID, null)
        set(value) = prefs.edit().putString(KEY_SESSION_ID, value).apply()

    var expiresAt: Long
        get() = prefs.getLong(KEY_EXPIRES_AT, 0)
        set(value) = prefs.edit().putLong(KEY_EXPIRES_AT, value).apply()

    var scopes: List<String>
        get() = prefs.getString(KEY_SCOPES, "")?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
        set(value) = prefs.edit().putString(KEY_SCOPES, value.joinToString(",")).apply()

    val isAuthenticated: Boolean get() = authToken != null && !isExpired
    val isExpired: Boolean get() = expiresAt > 0 && System.currentTimeMillis() > expiresAt

    // Connection state
    var lastHost: String?
        get() = prefs.getString(KEY_LAST_HOST, null)
        set(value) = prefs.edit().putString(KEY_LAST_HOST, value).apply()

    var lastPort: Int
        get() = prefs.getInt(KEY_LAST_PORT, 18789)
        set(value) = prefs.edit().putInt(KEY_LAST_PORT, value).apply()

    var lastTls: Boolean
        get() = prefs.getBoolean(KEY_LAST_TLS, false)
        set(value) = prefs.edit().putBoolean(KEY_LAST_TLS, value).apply()

    var serverVersion: String?
        get() = prefs.getString(KEY_SERVER_VERSION, null)
        set(value) = prefs.edit().putString(KEY_SERVER_VERSION, value).apply()

    var serverName: String?
        get() = prefs.getString(KEY_SERVER_NAME, null)
        set(value) = prefs.edit().putString(KEY_SERVER_NAME, value).apply()

    var lastAuthMs: Long
        get() = prefs.getLong(KEY_LAST_AUTH_MS, 0)
        set(value) = prefs.edit().putLong(KEY_LAST_AUTH_MS, value).apply()

    var authAttempts: Int
        get() = prefs.getInt(KEY_AUTH_ATTEMPTS, 0)
        set(value) = prefs.edit().putInt(KEY_AUTH_ATTEMPTS, value).apply()

    /**
     * Store a successful auth response.
     */
    fun saveAuthResponse(response: AuthResponse, host: String, port: Int, tls: Boolean) {
        authToken = response.sessionId // Use sessionId as token
        sessionId = response.sessionId
        expiresAt = response.expiresAt ?: 0
        scopes = response.scopes
        serverVersion = response.serverVersion
        serverName = response.serverName
        lastHost = host
        lastPort = port
        lastTls = tls
        lastAuthMs = System.currentTimeMillis()
        authAttempts = 0
        addConnectionHistory(host, port, tls, true)
        Log.i(TAG, "Auth saved for $host:$port (session=${response.sessionId?.take(8)}…)")
    }

    /**
     * Record a failed auth attempt.
     */
    fun recordAuthFailure(host: String, port: Int, tls: Boolean) {
        authAttempts++
        addConnectionHistory(host, port, tls, false)
    }

    /**
     * Check if a scope is granted.
     */
    fun hasScope(scope: String): Boolean = scope in scopes || "admin" in scopes

    /**
     * Clear all auth data (logout).
     */
    fun clearAuth() {
        authToken = null
        refreshToken = null
        sessionId = null
        expiresAt = 0
        scopes = emptyList()
        authAttempts = 0
        Log.i(TAG, "Auth cleared")
    }

    /**
     * Clear everything including connection history.
     */
    fun clearAll() {
        prefs.edit().clear().apply()
        Log.i(TAG, "All auth data cleared")
    }

    // Connection history
    private fun addConnectionHistory(host: String, port: Int, tls: Boolean, success: Boolean) {
        val history = getConnectionHistory().toMutableList()
        history.add(0, ConnectionRecord(host, port, tls, success, System.currentTimeMillis()))
        if (history.size > MAX_HISTORY) history.removeLast()
        val json = buildJsonArray {
            history.forEach { r ->
                add(buildJsonObject {
                    put("host", r.host); put("port", r.port)
                    put("tls", r.tls); put("success", r.success)
                    put("timestampMs", r.timestampMs)
                })
            }
        }.toString()
        prefs.edit().putString(KEY_CONNECTION_HISTORY, json).apply()
    }

    fun getConnectionHistory(): List<ConnectionRecord> {
        val json = prefs.getString(KEY_CONNECTION_HISTORY, null) ?: return emptyList()
        return try {
            Json.parseToJsonElement(json).jsonArray.map { elem ->
                val obj = elem.jsonObject
                ConnectionRecord(
                    host = obj["host"]?.jsonPrimitive?.contentOrNull ?: "",
                    port = obj["port"]?.jsonPrimitive?.intOrNull ?: 18789,
                    tls = obj["tls"]?.jsonPrimitive?.booleanOrNull ?: false,
                    success = obj["success"]?.jsonPrimitive?.booleanOrNull ?: false,
                    timestampMs = obj["timestampMs"]?.jsonPrimitive?.longOrNull ?: 0,
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    fun getLastSuccessfulConnection(): ConnectionRecord? {
        return getConnectionHistory().firstOrNull { it.success }
    }

    /**
     * Export auth state summary (non-sensitive).
     */
    fun exportSummary(): Map<String, Any?> = mapOf(
        "isAuthenticated" to isAuthenticated,
        "isExpired" to isExpired,
        "sessionId" to sessionId?.take(8)?.plus("…"),
        "scopes" to scopes,
        "lastHost" to lastHost,
        "lastPort" to lastPort,
        "serverVersion" to serverVersion,
        "authAttempts" to authAttempts,
        "historyCount" to getConnectionHistory().size,
    )
}

data class ConnectionRecord(
    val host: String,
    val port: Int,
    val tls: Boolean,
    val success: Boolean,
    val timestampMs: Long,
) {
    val displayName: String get() = "$host:$port${if (tls) " (TLS)" else ""}"
    val ageLabel: String get() {
        val ageMin = (System.currentTimeMillis() - timestampMs) / 60_000
        return when {
            ageMin < 1 -> "just now"
            ageMin < 60 -> "${ageMin}m ago"
            ageMin < 1440 -> "${ageMin / 60}h ago"
            else -> "${ageMin / 1440}d ago"
        }
    }
}
