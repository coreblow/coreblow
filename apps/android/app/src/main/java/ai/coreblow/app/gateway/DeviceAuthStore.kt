package ai.coreblow.app.gateway

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted storage for gateway device authentication tokens.
 *
 * Each gateway endpoint gets its own token, keyed by the endpoint's stable ID.
 * Uses AndroidX EncryptedSharedPreferences backed by Android Keystore.
 */
class DeviceAuthStore(context: Context) {

    companion object {
        private const val TAG = "DeviceAuthStore"
        private const val PREFS_NAME = "coreblow_device_auth"
        private const val KEY_PREFIX_TOKEN = "token:"
        private const val KEY_PREFIX_FINGERPRINT = "fingerprint:"
    }

    private val prefs by lazy {
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
    }

    /**
     * Store a device token for a specific gateway endpoint.
     */
    fun storeToken(endpointId: String, token: String) {
        prefs.edit()
            .putString("$KEY_PREFIX_TOKEN$endpointId", token)
            .apply()
        Log.d(TAG, "Token stored for endpoint: $endpointId")
    }

    /**
     * Retrieve the device token for a specific gateway endpoint.
     */
    fun getToken(endpointId: String): String? {
        return prefs.getString("$KEY_PREFIX_TOKEN$endpointId", null)
    }

    /**
     * Delete the device token for a specific gateway endpoint.
     */
    fun deleteToken(endpointId: String) {
        prefs.edit()
            .remove("$KEY_PREFIX_TOKEN$endpointId")
            .apply()
        Log.d(TAG, "Token deleted for endpoint: $endpointId")
    }

    /**
     * Store a TLS certificate fingerprint for a specific gateway endpoint.
     */
    fun storeFingerprint(endpointId: String, fingerprint: String) {
        prefs.edit()
            .putString("$KEY_PREFIX_FINGERPRINT$endpointId", fingerprint)
            .apply()
    }

    /**
     * Retrieve the stored TLS fingerprint for a specific gateway endpoint.
     */
    fun getFingerprint(endpointId: String): String? {
        return prefs.getString("$KEY_PREFIX_FINGERPRINT$endpointId", null)
    }

    /**
     * Check if a device token exists for a specific gateway endpoint.
     */
    fun hasToken(endpointId: String): Boolean {
        return getToken(endpointId) != null
    }

    /**
     * Clear all stored credentials (tokens and fingerprints).
     */
    fun clearAll() {
        prefs.edit().clear().apply()
        Log.i(TAG, "All credentials cleared")
    }

    /**
     * List all endpoint IDs that have stored tokens.
     */
    fun listPairedEndpoints(): List<String> {
        return prefs.all.keys
            .filter { it.startsWith(KEY_PREFIX_TOKEN) }
            .map { it.removePrefix(KEY_PREFIX_TOKEN) }
    }
}
