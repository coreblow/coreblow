package ai.coreblow.app.node

import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Processes gateway events (non-invoke messages) and dispatches
 * them to the appropriate subsystem.
 */
class GatewayEventHandler {

    companion object {
        private const val TAG = "GatewayEventHandler"
    }

    /** Registered event listeners by event type. */
    private val listeners = mutableMapOf<String, MutableList<(JsonObject) -> Unit>>()

    /**
     * Register a listener for a specific event type.
     */
    fun on(eventType: String, handler: (JsonObject) -> Unit) {
        listeners.getOrPut(eventType) { mutableListOf() }.add(handler)
    }

    /**
     * Remove all listeners for an event type.
     */
    fun off(eventType: String) {
        listeners.remove(eventType)
    }

    /**
     * Dispatch an event to registered listeners.
     */
    fun dispatch(eventType: String, payload: JsonObject) {
        Log.d(TAG, "Event: $eventType")
        listeners[eventType]?.forEach { listener ->
            try {
                listener(payload)
            } catch (e: Exception) {
                Log.e(TAG, "Event handler error for '$eventType': ${e.message}")
            }
        }
    }

    /**
     * Handle well-known gateway events.
     */
    fun handleSystemEvent(eventType: String, payload: JsonObject) {
        when (eventType) {
            "agent-started" -> {
                val agentName = (payload["name"] as? JsonPrimitive)?.content ?: "unknown"
                Log.i(TAG, "Agent started: $agentName")
            }
            "agent-stopped" -> {
                val agentName = (payload["name"] as? JsonPrimitive)?.content ?: "unknown"
                Log.i(TAG, "Agent stopped: $agentName")
            }
            "node-paired" -> Log.i(TAG, "Node paired successfully")
            "token-rotated" -> Log.i(TAG, "Auth token rotated")
            "gateway-shutdown" -> Log.w(TAG, "Gateway shutting down")
            else -> dispatch(eventType, payload)
        }
    }
}
