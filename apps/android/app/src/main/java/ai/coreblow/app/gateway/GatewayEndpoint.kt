package ai.coreblow.app.gateway

/**
 * Represents a discovered or manually configured gateway endpoint.
 */
data class GatewayEndpoint(
    val host: String,
    val port: Int,
    val useTls: Boolean = false,
    val source: DiscoverySource = DiscoverySource.MANUAL,
    val displayName: String? = null,
    val stableId: String? = null,
    val serverVersion: String? = null,
    val txtRecords: Map<String, String> = emptyMap(),
    val firstSeenMs: Long = System.currentTimeMillis(),
    val lastSeenMs: Long = System.currentTimeMillis(),
) {
    /** Display label for UI. */
    val label: String get() = displayName ?: "$host:$port"

    /** WebSocket URL. */
    val wsUrl: String get() {
        val scheme = if (useTls) "wss" else "ws"
        return "$scheme://$host:$port/ws"
    }

    /** HTTP base URL. */
    val httpUrl: String get() {
        val scheme = if (useTls) "https" else "http"
        return "$scheme://$host:$port"
    }

    /** Health check URL. */
    val healthUrl: String get() = "$httpUrl/health"

    /** Whether this endpoint has been seen recently (within 2 minutes). */
    val isRecent: Boolean get() = System.currentTimeMillis() - lastSeenMs < 120_000

    /** Age since first discovery in human-readable format. */
    val ageLabel: String get() {
        val ageMs = System.currentTimeMillis() - firstSeenMs
        val minutes = ageMs / 60_000
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            else -> "${minutes / 60}h ago"
        }
    }

    /** Unique key for deduplication. */
    val deduplicationKey: String get() = stableId ?: "$host:$port"

    /** Copy with updated lastSeenMs. */
    fun refreshed(): GatewayEndpoint = copy(lastSeenMs = System.currentTimeMillis())
}

/**
 * How the endpoint was discovered.
 */
enum class DiscoverySource {
    MDNS,
    MANUAL,
    SAVED,
    DEEP_LINK,
    QR_CODE,
}

/**
 * Device identity store interface for gateway authentication.
 */
interface DeviceIdentityStore {
    fun getDeviceId(): String
    fun getInstanceId(): String?
    fun getDisplayName(): String
}

/**
 * Device auth store interface for token persistence.
 */
interface DeviceAuthStore {
    fun getToken(): String?
    fun saveToken(token: String)
    fun clearToken()
}
