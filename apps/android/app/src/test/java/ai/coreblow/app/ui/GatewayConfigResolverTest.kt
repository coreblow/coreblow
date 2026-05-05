package ai.coreblow.app.ui

import ai.coreblow.app.ui.compose.GatewayConfigResolver
import ai.coreblow.app.gateway.DiscoverySource
import org.junit.Assert.*
import org.junit.Test

class GatewayConfigResolverTest {
    @Test fun `resolve host port`() { val ep = GatewayConfigResolver.resolve("192.168.1.1:8080"); assertNotNull(ep); assertEquals("192.168.1.1", ep!!.host); assertEquals(8080, ep.port) }
    @Test fun `resolve ws url`() { val ep = GatewayConfigResolver.resolve("ws://myhost:9090/ws"); assertNotNull(ep); assertEquals("myhost", ep!!.host); assertFalse(ep.useTls) }
    @Test fun `resolve wss url`() { val ep = GatewayConfigResolver.resolve("wss://secure:443/ws"); assertNotNull(ep); assertTrue(ep!!.useTls) }
    @Test fun `resolve coreblow scheme`() { val ep = GatewayConfigResolver.resolve("coreblow://gw:8443"); assertNotNull(ep); assertEquals(DiscoverySource.QR_CODE, ep!!.source) }
    @Test fun `resolve bare hostname`() { val ep = GatewayConfigResolver.resolve("mygateway"); assertNotNull(ep); assertEquals("mygateway", ep!!.host); assertEquals(8080, ep.port) }
    @Test fun `resolve blank returns null`() = assertNull(GatewayConfigResolver.resolve(""))
    @Test fun `fromQrCode sets QR source`() { val ep = GatewayConfigResolver.fromQrCode("ws://host:8080"); assertNotNull(ep); assertEquals(DiscoverySource.QR_CODE, ep!!.source) }
}
