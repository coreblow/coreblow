package ai.coreblow.app.node.handlers

import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class DebugHandler : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_DEBUG

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "ping" -> buildJsonObject { put("pong", true); put("ts", System.currentTimeMillis()) }
            "echo" -> buildJsonObject { put("echo", params["message"]?.jsonPrimitive?.content ?: "") }
            "diagnostics" -> buildJsonObject {
                put("runtime", "Android ${android.os.Build.VERSION.RELEASE}")
                put("sdk", android.os.Build.VERSION.SDK_INT)
                put("heapMb", Runtime.getRuntime().maxMemory() / (1024 * 1024))
                put("freeHeapMb", Runtime.getRuntime().freeMemory() / (1024 * 1024))
                put("processors", Runtime.getRuntime().availableProcessors())
            }
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }
}
