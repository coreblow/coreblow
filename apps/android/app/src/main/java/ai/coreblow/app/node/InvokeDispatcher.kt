package ai.coreblow.app.node

import android.util.Log
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.gateway.InvokeError
import ai.coreblow.app.gateway.InvokeErrorParser
import ai.coreblow.app.gateway.GatewaySession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Handler interface for node invoke commands.
 *
 * Each handler processes a specific set of commands within a namespace.
 */
interface InvokeHandler {
    /** The command namespace this handler responds to. */
    val namespace: String

    /** Execute a command and return the result. */
    suspend fun execute(command: String, params: JsonObject): JsonElement
}

/**
 * Routes incoming invoke requests from the gateway to the appropriate handler.
 *
 * Manages handler registration, command dispatch, timeout enforcement,
 * and error response generation.
 */
class InvokeDispatcher(
    private val scope: CoroutineScope,
    private val session: GatewaySession,
) {
    companion object {
        private const val TAG = "InvokeDispatcher"
        private const val DEFAULT_TIMEOUT_MS = 30_000L
    }

    private val handlers = mutableMapOf<String, InvokeHandler>()

    /**
     * Register a handler for a command namespace.
     */
    fun register(handler: InvokeHandler) {
        handlers[handler.namespace] = handler
        Log.d(TAG, "Registered handler: ${handler.namespace}")
    }

    /**
     * Dispatch an invoke request to the appropriate handler.
     *
     * @param requestId The gateway request ID for response correlation
     * @param fullCommand The fully qualified command (e.g., "camera.capture-photo")
     * @param params The command parameters
     */
    fun dispatch(requestId: String, fullCommand: String, params: JsonObject) {
        val parts = fullCommand.split(".", limit = 2)
        if (parts.size != 2) {
            session.sendError(requestId, InvokeErrorParser.localError(
                CoreBlowProtocol.ERR_UNKNOWN_COMMAND,
                "Invalid command format: $fullCommand",
            ))
            return
        }

        val namespace = parts[0]
        val command = parts[1]

        val handler = handlers[namespace]
        if (handler == null) {
            session.sendError(requestId, InvokeErrorParser.localError(
                CoreBlowProtocol.ERR_UNKNOWN_COMMAND,
                "No handler for namespace: $namespace",
            ))
            return
        }

        scope.launch(Dispatchers.IO) {
            try {
                val result = withTimeout(DEFAULT_TIMEOUT_MS) {
                    handler.execute(command, params)
                }
                session.sendResult(requestId, result)
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                Log.e(TAG, "Command timeout: $fullCommand")
                session.sendError(requestId, InvokeErrorParser.localError(
                    CoreBlowProtocol.ERR_TIMEOUT,
                    "Command timed out: $fullCommand",
                ))
            } catch (e: SecurityException) {
                Log.e(TAG, "Permission denied: $fullCommand — ${e.message}")
                session.sendError(requestId, InvokeErrorParser.localError(
                    CoreBlowProtocol.ERR_PERMISSION_DENIED,
                    e.message ?: "Permission denied",
                ))
            } catch (e: Exception) {
                Log.e(TAG, "Command failed: $fullCommand — ${e.message}", e)
                session.sendError(requestId, InvokeErrorParser.localError(
                    CoreBlowProtocol.ERR_INTERNAL,
                    e.message ?: "Internal error",
                ))
            }
        }
    }
}
