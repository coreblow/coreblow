package ai.coreblow.app.node

import ai.coreblow.app.gateway.GatewayEndpoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ConnectionManagerTest {
    @Test
    fun resolveTlsParamsForEndpoint_prefersStoredPinOverAdvertisedFingerprint() {
        val endpoint = GatewayEndpoint(
            stableId = "_coreblow-gw._tcp.|local.|Test", name = "Test",
            host = "10.0.0.2", port = 18789, tlsEnabled = true, tlsFingerprintSha256 = "attacker",
        )
        val params = ConnectionManager.resolveTlsParamsForEndpoint(endpoint, storedFingerprint = "legit", manualTlsEnabled = false)
        assertEquals("legit", params?.expectedFingerprint)
        assertEquals(false, params?.allowTOFU)
    }

    @Test
    fun resolveTlsParamsForEndpoint_doesNotTrustAdvertisedFingerprintWhenNoStoredPin() {
        val endpoint = GatewayEndpoint(
            stableId = "_coreblow-gw._tcp.|local.|Test", name = "Test",
            host = "10.0.0.2", port = 18789, tlsEnabled = true, tlsFingerprintSha256 = "attacker",
        )
        val params = ConnectionManager.resolveTlsParamsForEndpoint(endpoint, storedFingerprint = null, manualTlsEnabled = false)
        assertNull(params?.expectedFingerprint)
        assertEquals(false, params?.allowTOFU)
    }

    @Test
    fun resolveTlsParamsForEndpoint_manualRespectsManualTlsToggle() {
        val endpoint = GatewayEndpoint.manual(host = "example.com", port = 443)
        val off = ConnectionManager.resolveTlsParamsForEndpoint(endpoint, storedFingerprint = null, manualTlsEnabled = false)
        assertNull(off)
        val on = ConnectionManager.resolveTlsParamsForEndpoint(endpoint, storedFingerprint = null, manualTlsEnabled = true)
        assertNull(on?.expectedFingerprint)
        assertEquals(false, on?.allowTOFU)
    }

    @Test
    fun resolveTlsParamsForEndpoint_nonTlsReturnsNull() {
        val endpoint = GatewayEndpoint(
            stableId = "test", name = "Test",
            host = "10.0.0.2", port = 18789, tlsEnabled = false,
        )
        val params = ConnectionManager.resolveTlsParamsForEndpoint(endpoint, storedFingerprint = null, manualTlsEnabled = false)
        assertNull(params)
    }

    @Test
    fun stableId_discoveredEndpoint_usesServiceFormat() {
        val endpoint = GatewayEndpoint(
            stableId = "_coreblow-gw._tcp.|local.|MyServer",
            name = "MyServer", host = "192.168.1.5", port = 18789, tlsEnabled = true,
        )
        assertTrue(endpoint.stableId.contains("_coreblow-gw._tcp."))
    }

    @Test
    fun stableId_manualEndpoint_usesManualPrefix() {
        val endpoint = GatewayEndpoint.manual(host = "example.com", port = 443)
        assertTrue(endpoint.stableId.startsWith("manual|"))
    }

    @Test
    fun connectionState_valuesAreDefined() {
        val states = ConnectionManager.State.entries
        assertTrue(states.size >= 3) // Disconnected, Connecting, Connected
    }
}
