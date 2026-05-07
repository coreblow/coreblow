package ai.coreblow.app.gateway

import android.util.Log
import kotlinx.serialization.json.*

/**
 * Parses and categorizes invoke error responses from the gateway.
 * Provides structured error handling with retry guidance,
 * user-facing messages, and error chain tracking.
 */
class InvokeErrorParser {

    companion object {
        private const val TAG = "InvokeErrorParser"
    }

    private val errorHistory = ArrayDeque<InvokeError>(50)

    /**
     * Parse a raw error JSON from gateway into structured InvokeError.
     */
    fun parse(raw: String): InvokeError {
        return try {
            val json = Json.parseToJsonElement(raw).jsonObject
            val errorObj = json["error"]?.jsonObject

            val code = errorObj?.get("code")?.jsonPrimitive?.intOrNull
                ?: json["code"]?.jsonPrimitive?.intOrNull
                ?: CoreBlowProtocol.ERR_UNKNOWN

            val message = errorObj?.get("message")?.jsonPrimitive?.contentOrNull
                ?: json["message"]?.jsonPrimitive?.contentOrNull
                ?: "Unknown error"

            val details = errorObj?.get("details")?.jsonPrimitive?.contentOrNull
            val namespace = json["namespace"]?.jsonPrimitive?.contentOrNull
            val command = json["command"]?.jsonPrimitive?.contentOrNull
            val requestId = json["id"]?.jsonPrimitive?.contentOrNull

            val error = InvokeError(
                code = code,
                message = message,
                details = details,
                namespace = namespace,
                command = command,
                requestId = requestId,
                category = categorize(code),
                isRetryable = isRetryable(code),
                userMessage = userFacingMessage(code, message),
                timestampMs = System.currentTimeMillis(),
            )

            trackError(error)
            error
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse error: ${e.message}")
            val fallback = InvokeError(
                code = CoreBlowProtocol.ERR_UNKNOWN,
                message = raw.take(200),
                category = ErrorCategory.UNKNOWN,
                isRetryable = false,
                userMessage = "An unexpected error occurred",
                timestampMs = System.currentTimeMillis(),
            )
            trackError(fallback)
            fallback
        }
    }

    /**
     * Parse from a JsonObject directly.
     */
    fun parseFromJson(json: JsonObject): InvokeError {
        return parse(json.toString())
    }

    /**
     * Get recent error history.
     */
    fun getRecentErrors(count: Int = 10): List<InvokeError> {
        return errorHistory.takeLast(count)
    }

    /**
     * Get error count by category.
     */
    fun getErrorStats(): Map<ErrorCategory, Int> {
        return errorHistory.groupBy { it.category }.mapValues { it.value.size }
    }

    /**
     * Clear error history.
     */
    fun clearHistory() { errorHistory.clear() }

    /**
     * Check if a specific error code has occurred recently.
     */
    fun hasRecentError(code: Int, withinMs: Long = 60_000): Boolean {
        val cutoff = System.currentTimeMillis() - withinMs
        return errorHistory.any { it.code == code && it.timestampMs > cutoff }
    }

    /**
     * Get suggested retry delay for an error.
     */
    fun suggestedRetryDelayMs(error: InvokeError): Long {
        if (!error.isRetryable) return -1
        val recentCount = errorHistory.count { it.code == error.code && System.currentTimeMillis() - it.timestampMs < 60_000 }
        return when {
            recentCount <= 1 -> 1_000L
            recentCount <= 3 -> 3_000L
            recentCount <= 5 -> 10_000L
            else -> 30_000L
        }
    }

    private fun trackError(error: InvokeError) {
        if (errorHistory.size >= 50) errorHistory.removeFirst()
        errorHistory.addLast(error)
    }

    private fun categorize(code: Int): ErrorCategory = when (code) {
        CoreBlowProtocol.ERR_AUTH_FAILED -> ErrorCategory.AUTH
        CoreBlowProtocol.ERR_PERMISSION_DENIED -> ErrorCategory.PERMISSION
        CoreBlowProtocol.ERR_NOT_FOUND -> ErrorCategory.NOT_FOUND
        CoreBlowProtocol.ERR_INVALID_PARAMS -> ErrorCategory.VALIDATION
        CoreBlowProtocol.ERR_TIMEOUT -> ErrorCategory.TIMEOUT
        CoreBlowProtocol.ERR_RATE_LIMIT -> ErrorCategory.RATE_LIMIT
        CoreBlowProtocol.ERR_INTERNAL -> ErrorCategory.SERVER
        CoreBlowProtocol.ERR_NOT_SUPPORTED -> ErrorCategory.NOT_SUPPORTED
        CoreBlowProtocol.ERR_BUSY -> ErrorCategory.BUSY
        CoreBlowProtocol.ERR_CANCELLED -> ErrorCategory.CANCELLED
        CoreBlowProtocol.ERR_DISCONNECTED -> ErrorCategory.CONNECTION
        CoreBlowProtocol.ERR_PAYLOAD_TOO_LARGE -> ErrorCategory.VALIDATION
        else -> ErrorCategory.UNKNOWN
    }

    private fun isRetryable(code: Int): Boolean = code in setOf(
        CoreBlowProtocol.ERR_TIMEOUT,
        CoreBlowProtocol.ERR_RATE_LIMIT,
        CoreBlowProtocol.ERR_INTERNAL,
        CoreBlowProtocol.ERR_BUSY,
        CoreBlowProtocol.ERR_DISCONNECTED,
    )

    private fun userFacingMessage(code: Int, serverMessage: String): String = when (code) {
        CoreBlowProtocol.ERR_AUTH_FAILED -> "Authentication failed. Please reconnect."
        CoreBlowProtocol.ERR_PERMISSION_DENIED -> "Permission denied. Check device permissions."
        CoreBlowProtocol.ERR_NOT_FOUND -> "The requested resource was not found."
        CoreBlowProtocol.ERR_INVALID_PARAMS -> "Invalid request. Please try again."
        CoreBlowProtocol.ERR_TIMEOUT -> "Request timed out. Retrying…"
        CoreBlowProtocol.ERR_RATE_LIMIT -> "Too many requests. Please wait a moment."
        CoreBlowProtocol.ERR_INTERNAL -> "Server error. Retrying…"
        CoreBlowProtocol.ERR_BUSY -> "Device is busy. Please try again shortly."
        CoreBlowProtocol.ERR_CANCELLED -> "Request was cancelled."
        CoreBlowProtocol.ERR_DISCONNECTED -> "Connection lost. Reconnecting…"
        CoreBlowProtocol.ERR_PAYLOAD_TOO_LARGE -> "Data too large to send."
        else -> serverMessage.take(100)
    }
}

data class InvokeError(
    val code: Int,
    val message: String,
    val details: String? = null,
    val namespace: String? = null,
    val command: String? = null,
    val requestId: String? = null,
    val category: ErrorCategory,
    val isRetryable: Boolean,
    val userMessage: String,
    val timestampMs: Long,
)

enum class ErrorCategory {
    AUTH, PERMISSION, NOT_FOUND, VALIDATION, TIMEOUT,
    RATE_LIMIT, SERVER, NOT_SUPPORTED, BUSY, CANCELLED,
    CONNECTION, UNKNOWN,
}
