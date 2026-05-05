package ai.coreblow.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayEndpointTest {

    @Test
    fun `stableId for manual endpoint starts with manual`() {
        val ep = GatewayEndpoint("192.168.1.100", 8080, source = DiscoverySource.MANUAL)
        assertTrue(ep.stableId.startsWith("manual|"))
    }

    @Test
    fun `stableId for bonjour endpoint starts with bonjour`() {
        val ep = GatewayEndpoint("192.168.1.100", 8080, source = DiscoverySource.BONJOUR)
        assertTrue(ep.stableId.startsWith("bonjour|"))
    }

    @Test
    fun `stableId for qr endpoint starts with qr`() {
        val ep = GatewayEndpoint("10.0.0.1", 443, source = DiscoverySource.QR_CODE)
        assertTrue(ep.stableId.startsWith("qr|"))
    }

    @Test
    fun `wsUrl uses wss for TLS`() {
        val ep = GatewayEndpoint("host.local", 443, useTls = true)
        assertTrue(ep.wsUrl.startsWith("wss://"))
    }

    @Test
    fun `wsUrl uses ws for non-TLS`() {
        val ep = GatewayEndpoint("host.local", 8080, useTls = false)
        assertTrue(ep.wsUrl.startsWith("ws://"))
    }

    @Test
    fun `wsUrl includes host port and path`() {
        val ep = GatewayEndpoint("myhost", 9090, useTls = false, path = "/gateway")
        assertEquals("ws://myhost:9090/gateway", ep.wsUrl)
    }

    @Test
    fun `label uses displayName when available`() {
        val ep = GatewayEndpoint("10.0.0.1", 443, displayName = "My Gateway")
        assertEquals("My Gateway", ep.label)
    }

    @Test
    fun `label falls back to host port`() {
        val ep = GatewayEndpoint("10.0.0.1", 443)
        assertEquals("10.0.0.1:443", ep.label)
    }

    @Test
    fun `different endpoints have different stableIds`() {
        val ep1 = GatewayEndpoint("10.0.0.1", 443)
        val ep2 = GatewayEndpoint("10.0.0.2", 443)
        assertNotEquals(ep1.stableId, ep2.stableId)
    }
}
