package ai.coreblow.app

import org.junit.Assert.*
import org.junit.Test

class SessionKeyTest {
    @Test fun `stable id is deterministic`() {
        val ep = ai.coreblow.app.gateway.GatewayEndpoint("host", 8080)
        assertEquals(ep.stableId, ep.stableId)
    }
    @Test fun `different hosts produce different keys`() {
        val a = ai.coreblow.app.gateway.GatewayEndpoint("a", 8080)
        val b = ai.coreblow.app.gateway.GatewayEndpoint("b", 8080)
        assertNotEquals(a.stableId, b.stableId)
    }
    @Test fun `different ports produce different keys`() {
        val a = ai.coreblow.app.gateway.GatewayEndpoint("host", 8080)
        val b = ai.coreblow.app.gateway.GatewayEndpoint("host", 9090)
        assertNotEquals(a.stableId, b.stableId)
    }
}
