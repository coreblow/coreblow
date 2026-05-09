package ai.coreblow.app.ui

import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class GatewayConfigResolverTest {
    @Test
    fun parseGatewayEndpointUsesDefaultTlsPortForBareWssUrls() {
        val parsed = parseGatewayEndpoint("wss://gateway.example")
        assertEquals(GatewayEndpointConfig(host = "gateway.example", port = 443, tls = true, displayUrl = "https://gateway.example"), parsed)
    }

    @Test
    fun parseGatewayEndpointUsesDefaultCleartextPortForBareWsUrls() {
        val parsed = parseGatewayEndpoint("ws://gateway.example")
        assertEquals(GatewayEndpointConfig(host = "gateway.example", port = 18789, tls = false, displayUrl = "http://gateway.example:18789"), parsed)
    }

    @Test
    fun parseGatewayEndpointOmitsExplicitDefaultTlsPortFromDisplayUrl() {
        val parsed = parseGatewayEndpoint("https://gateway.example:443")
        assertEquals(GatewayEndpointConfig(host = "gateway.example", port = 443, tls = true, displayUrl = "https://gateway.example"), parsed)
    }

    @Test
    fun parseGatewayEndpointKeepsExplicitNonDefaultPortInDisplayUrl() {
        val parsed = parseGatewayEndpoint("http://gateway.example:8080")
        assertEquals(GatewayEndpointConfig(host = "gateway.example", port = 8080, tls = false, displayUrl = "http://gateway.example:8080"), parsed)
    }

    @Test
    fun parseGatewayEndpointKeepsExplicitCleartextPort80InDisplayUrl() {
        val parsed = parseGatewayEndpoint("http://gateway.example:80")
        assertEquals(GatewayEndpointConfig(host = "gateway.example", port = 80, tls = false, displayUrl = "http://gateway.example:80"), parsed)
    }

    @Test
    fun resolveScannedSetupCodeAcceptsRawSetupCode() {
        val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","bootstrapToken":"bootstrap-1"}""")
        val resolved = resolveScannedSetupCode(setupCode)
        assertEquals(setupCode, resolved)
    }

    @Test
    fun resolveScannedSetupCodeAcceptsQrJsonPayload() {
        val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","bootstrapToken":"bootstrap-1"}""")
        val qrJson = """{"setupCode":"$setupCode","gatewayUrl":"wss://gateway.example:18789","auth":"password","urlSource":"gateway.remote.url"}"""
        val resolved = resolveScannedSetupCode(qrJson)
        assertEquals(setupCode, resolved)
    }

    @Test
    fun resolveScannedSetupCodeRejectsInvalidInput() {
        assertNull(resolveScannedSetupCode("not-a-valid-setup-code"))
    }

    @Test
    fun resolveScannedSetupCodeRejectsJsonWithInvalidSetupCode() {
        assertNull(resolveScannedSetupCode("""{"setupCode":"invalid"}"""))
    }

    @Test
    fun resolveScannedSetupCodeRejectsJsonWithNonStringSetupCode() {
        assertNull(resolveScannedSetupCode("""{"setupCode":{"nested":"value"}}"""))
    }

    @Test
    fun decodeGatewaySetupCodeParsesBootstrapToken() {
        val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","bootstrapToken":"bootstrap-1"}""")
        val decoded = decodeGatewaySetupCode(setupCode)
        assertEquals("wss://gateway.example:18789", decoded?.url)
        assertEquals("bootstrap-1", decoded?.bootstrapToken)
        assertNull(decoded?.token)
        assertNull(decoded?.password)
    }

    @Test
    fun resolveGatewayConnectConfigPrefersBootstrapTokenFromSetupCode() {
        val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","bootstrapToken":"bootstrap-1"}""")
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = true, setupCode = setupCode, manualHost = "", manualPort = "", manualTls = true,
            fallbackToken = "shared-token", fallbackPassword = "shared-password", // pragma: allowlist secret
        )
        assertEquals("gateway.example", resolved?.host)
        assertEquals(18789, resolved?.port)
        assertEquals(true, resolved?.tls)
        assertEquals("bootstrap-1", resolved?.bootstrapToken)
        assertNull(resolved?.token?.takeIf { it.isNotEmpty() })
        assertNull(resolved?.password?.takeIf { it.isNotEmpty() })
    }

    @Test
    fun resolveGatewayConnectConfigDefaultsPortlessWssSetupCodeTo443() {
        val setupCode = encodeSetupCode("""{"url":"wss://gateway.example","bootstrapToken":"bootstrap-1"}""")
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = true, setupCode = setupCode, manualHost = "", manualPort = "", manualTls = true,
            fallbackToken = "shared-token", fallbackPassword = "shared-password", // pragma: allowlist secret
        )
        assertEquals("gateway.example", resolved?.host)
        assertEquals(443, resolved?.port)
        assertEquals(true, resolved?.tls)
        assertEquals("bootstrap-1", resolved?.bootstrapToken)
    }

    @Test fun resolveGateway_manualIgnoresSetupCode() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "ignored", manualHost = "my-host", manualPort = "9090", manualTls = false,
            fallbackToken = "token-1", fallbackPassword = null, // pragma: allowlist secret
        )
        assertEquals("my-host", resolved?.host)
        assertEquals(9090, resolved?.port)
        assertEquals(false, resolved?.tls)
    }

    @Test fun resolveGateway_manualDefaultPort() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "", manualHost = "local", manualPort = "", manualTls = false,
            fallbackToken = null, fallbackPassword = null,
        )
        assertEquals(GatewayConfigResolver.DEFAULT_PORT, resolved?.port)
    }

    @Test fun resolveGateway_emptyManualHostReturnsNull() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "", manualHost = "", manualPort = "18789", manualTls = false,
            fallbackToken = null, fallbackPassword = null,
        )
        assertNull(resolved)
    }

    @Test fun resolveGateway_invalidPortReturnsNull() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "", manualHost = "host", manualPort = "0", manualTls = false,
            fallbackToken = null, fallbackPassword = null,
        )
        assertNull(resolved)
    }

    @Test fun resolveGateway_portOverflow_isRejected() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "", manualHost = "host", manualPort = "70000", manualTls = false,
            fallbackToken = null, fallbackPassword = null,
        )
        assertNull(resolved)
    }

    @Test fun resolveGateway_tokenAndPassword_bothPresent() {
        val resolved = resolveGatewayConnectConfig(
            useSetupCode = false, setupCode = "", manualHost = "host", manualPort = "18789", manualTls = false,
            fallbackToken = "t1", fallbackPassword = "p1", // pragma: allowlist secret
        )
        assertEquals("t1", resolved?.token)
        assertEquals("p1", resolved?.password)
    }

    @Test fun defaultPort_is18789() {
        assertEquals(18789, GatewayConfigResolver.DEFAULT_PORT)
    }

    private fun encodeSetupCode(payloadJson: String): String {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.toByteArray(Charsets.UTF_8))
    }
}
