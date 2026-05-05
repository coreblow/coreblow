package ai.coreblow.app.gateway

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Parses gateway invoke error responses into typed error objects.
 */
data class InvokeError(
    val code: String,
    val message: String,
    val detail: String? = null,
    val retryable: Boolean = false,
) {
    val isAuthError: Boolean
        get() = code == CoreBlowProtocol.ERR_AUTH_FAILED

    val isPermissionError: Boolean
        get() = code == CoreBlowProtocol.ERR_PERMISSION_DENIED

    val isTimeoutError: Boolean
        get() = code == CoreBlowProtocol.ERR_TIMEOUT
}

object InvokeErrorParser {

    /**
     * Parse a JSON error payload from the gateway into an [InvokeError].
     *
     * Expected shape:
     * ```json
     * { "code": "permission-denied", "message": "Camera access not granted", "detail": "..." }
     * ```
     */
    fun parse(payload: JsonElement?): InvokeError {
        if (payload == null) {
            return InvokeError(
                code = CoreBlowProtocol.ERR_INTERNAL,
                message = "Empty error payload",
            )
        }

        val obj = try {
            payload.jsonObject
        } catch (_: IllegalArgumentException) {
            return InvokeError(
                code = CoreBlowProtocol.ERR_INTERNAL,
                message = payload.toString(),
            )
        }

        val code = obj.stringOrNull("code") ?: CoreBlowProtocol.ERR_INTERNAL
        val message = obj.stringOrNull("message") ?: "Unknown error"
        val detail = obj.stringOrNull("detail")
        val retryable = RETRYABLE_CODES.contains(code)

        return InvokeError(
            code = code,
            message = message,
            detail = detail,
            retryable = retryable,
        )
    }

    /**
     * Build a local error (not from gateway) for handler-side failures.
     */
    fun localError(code: String, message: String): InvokeError {
        return InvokeError(code = code, message = message, retryable = false)
    }

    private val RETRYABLE_CODES = setOf(
        CoreBlowProtocol.ERR_TIMEOUT,
        CoreBlowProtocol.ERR_INTERNAL,
    )

    private fun JsonObject.stringOrNull(key: String): String? {
        val element = this[key] ?: return null
        return try {
            element.jsonPrimitive.content
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
