package ai.coreblow.app.node

import ai.coreblow.app.gateway.CoreBlowProtocol
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test

class DebugHandlerTest {

    private val handler = ai.coreblow.app.node.handlers.DebugHandler()

    @Test
    fun `namespace is debug`() {
        assertEquals(CoreBlowProtocol.NS_DEBUG, handler.namespace)
    }

    @Test
    fun `ping returns pong true`() = kotlinx.coroutines.test.runTest {
        val result = handler.execute("ping", buildJsonObject {})
        val obj = result as kotlinx.serialization.json.JsonObject
        assertEquals("true", obj["pong"]?.toString())
    }

    @Test
    fun `echo returns the message`() = kotlinx.coroutines.test.runTest {
        val params = buildJsonObject { put("message", "hello world") }
        val result = handler.execute("echo", params) as kotlinx.serialization.json.JsonObject
        assertEquals("\"hello world\"", result["echo"]?.toString())
    }

    @Test
    fun `echo with no message returns empty`() = kotlinx.coroutines.test.runTest {
        val result = handler.execute("echo", buildJsonObject {}) as kotlinx.serialization.json.JsonObject
        assertEquals("\"\"", result["echo"]?.toString())
    }

    @Test
    fun `diagnostics returns runtime info`() = kotlinx.coroutines.test.runTest {
        val result = handler.execute("diagnostics", buildJsonObject {}) as kotlinx.serialization.json.JsonObject
        assert(result.containsKey("heapMb"))
        assert(result.containsKey("processors"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `unknown command throws`() = kotlinx.coroutines.test.runTest {
        handler.execute("nonexistent", buildJsonObject {})
    }
}
