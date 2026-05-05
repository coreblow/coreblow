package ai.coreblow.app.gateway

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Test

class GatewayProtocolTest {
    @Test fun `buildPing has type ping`() { val msg = GatewayProtocol.buildPing(); assertEquals("\"ping\"", msg["type"].toString()) }
    @Test fun `buildBye has type bye`() { val msg = GatewayProtocol.buildBye(); assertEquals("\"bye\"", msg["type"].toString()) }
    @Test fun `buildBye includes reason`() { val msg = GatewayProtocol.buildBye("test"); assertEquals("\"test\"", msg["reason"].toString()) }
    @Test fun `extractType works`() { val msg = buildJsonObject { put("type", "invoke") }; assertEquals("invoke", GatewayProtocol.extractType(msg)) }
    @Test fun `extractCommand works`() { val msg = buildJsonObject { put("command", "camera.capture") }; assertEquals("camera.capture", GatewayProtocol.extractCommand(msg)) }
    @Test fun `extractRequestId works`() { val msg = buildJsonObject { put("id", "req-1") }; assertEquals("req-1", GatewayProtocol.extractRequestId(msg)) }
    @Test fun `extractParams returns empty for missing`() { val msg = buildJsonObject {}; assertTrue(GatewayProtocol.extractParams(msg).isEmpty()) }
}
