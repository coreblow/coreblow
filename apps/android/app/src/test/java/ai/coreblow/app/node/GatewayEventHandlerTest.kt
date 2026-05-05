package ai.coreblow.app.node

import org.junit.Assert.*
import org.junit.Test

class GatewayEventHandlerTest {
    private val handler = GatewayEventHandler()

    @Test fun `dispatch calls registered listener`() {
        var called = false
        handler.on("test-event") { called = true }
        handler.dispatch("test-event", kotlinx.serialization.json.buildJsonObject {})
        assertTrue(called)
    }
    @Test fun `off removes listener`() {
        var count = 0
        handler.on("ev") { count++ }
        handler.dispatch("ev", kotlinx.serialization.json.buildJsonObject {})
        handler.off("ev")
        handler.dispatch("ev", kotlinx.serialization.json.buildJsonObject {})
        assertEquals(1, count)
    }
    @Test fun `handleSystemEvent does not crash on known events`() {
        handler.handleSystemEvent("agent-started", kotlinx.serialization.json.buildJsonObject { put("name", kotlinx.serialization.json.JsonPrimitive("test")) })
        handler.handleSystemEvent("gateway-shutdown", kotlinx.serialization.json.buildJsonObject {})
    }
}
