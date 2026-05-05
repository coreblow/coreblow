package ai.coreblow.app.gateway

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Protocol message builder and parser for the gateway wire format.
 *
 * Provides typed constructors for all message types and utility
 * methods for extracting fields from incoming messages.
 */
object GatewayProtocol {

    /** Build a hello message for the handshake. */
    fun buildHello(options: GatewayConnectOptions, token: String?): JsonObject = buildJsonObject {
        put("type", CoreBlowProtocol.MSG_HELLO)
        put("version", CoreBlowProtocol.PROTOCOL_VERSION)
        put("role", options.role)
    }

    /** Build an auth message with device token. */
    fun buildAuth(authType: String, token: String): JsonObject = buildJsonObject {
        put("type", CoreBlowProtocol.MSG_AUTH)
        put("authType", authType)
        put("token", token)
    }

    /** Build a ping message. */
    fun buildPing(): JsonObject = buildJsonObject {
        put("type", CoreBlowProtocol.MSG_PING)
        put("ts", System.currentTimeMillis())
    }

    /** Build a bye message for graceful disconnect. */
    fun buildBye(reason: String = "client-disconnect"): JsonObject = buildJsonObject {
        put("type", CoreBlowProtocol.MSG_BYE)
        put("reason", reason)
    }

    /** Extract the message type from a raw JSON message. */
    fun extractType(message: JsonObject): String? {
        return (message["type"] as? JsonPrimitive)?.content
    }

    /** Extract the request ID from an invoke/result/error message. */
    fun extractRequestId(message: JsonObject): String? {
        return (message["id"] as? JsonPrimitive)?.content
    }

    /** Extract the command from an invoke message. */
    fun extractCommand(message: JsonObject): String? {
        return (message["command"] as? JsonPrimitive)?.content
    }

    /** Extract params from an invoke message. */
    fun extractParams(message: JsonObject): JsonObject {
        return message["params"] as? JsonObject ?: JsonObject(emptyMap())
    }
}
