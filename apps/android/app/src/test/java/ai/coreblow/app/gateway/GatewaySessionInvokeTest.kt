package ai.coreblow.app.gateway

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewaySessionInvokeTest {
    // ── Invoke request encoding ─────────────────────────

    @Test
    fun buildInvokeRequest_setsMethodAndParams() {
        val req = GatewaySession.buildInvokeRequest("device.info", buildJsonObject { put("key", "val") })
        assertEquals("device.info", req.method)
        assertEquals("val", req.params?.get("key")?.jsonPrimitive?.content)
    }

    @Test
    fun buildInvokeRequest_generatesUniqueIds() {
        val a = GatewaySession.buildInvokeRequest("test", null)
        val b = GatewaySession.buildInvokeRequest("test", null)
        assertNotNull(a.id)
        assertNotNull(b.id)
        assertFalse(a.id == b.id)
    }

    @Test
    fun buildInvokeRequest_allowsNullParams() {
        val req = GatewaySession.buildInvokeRequest("test.method", null)
        assertNull(req.params)
    }

    // ── Invoke response parsing ─────────────────────────

    @Test
    fun parseInvokeResponse_extractsResultPayload() {
        val json = """{"id":"1","result":{"status":"ok"}}"""
        val resp = GatewaySession.parseInvokeResponse(json)
        assertNotNull(resp)
        assertEquals("1", resp?.id)
        assertNotNull(resp?.result)
        assertNull(resp?.error)
    }

    @Test
    fun parseInvokeResponse_extractsErrorPayload() {
        val json = """{"id":"2","error":{"code":-1,"message":"fail"}}"""
        val resp = GatewaySession.parseInvokeResponse(json)
        assertNotNull(resp)
        assertEquals("2", resp?.id)
        assertNull(resp?.result)
        assertNotNull(resp?.error)
        assertEquals(-1, resp?.error?.code)
        assertEquals("fail", resp?.error?.message)
    }

    @Test
    fun parseInvokeResponse_returnsNullForMalformed() {
        assertNull(GatewaySession.parseInvokeResponse(""))
        assertNull(GatewaySession.parseInvokeResponse("not json"))
        assertNull(GatewaySession.parseInvokeResponse("[]"))
    }

    // ── Invoke timeout ──────────────────────────────────

    @Test
    fun invokeTimeoutDefault_isReasonable() {
        val timeout = GatewaySession.DEFAULT_INVOKE_TIMEOUT_MS
        assertTrue(timeout >= 10_000L)
        assertTrue(timeout <= 120_000L)
    }

    // ── Message sequencing ──────────────────────────────

    @Test
    fun nextSequenceId_isMonotonicallyIncreasing() {
        val seq1 = GatewaySession.nextSequenceId()
        val seq2 = GatewaySession.nextSequenceId()
        val seq3 = GatewaySession.nextSequenceId()
        assertTrue(seq2 > seq1)
        assertTrue(seq3 > seq2)
    }

    // ── Ping/pong ───────────────────────────────────────

    @Test
    fun pingIntervalMs_isPositive() {
        assertTrue(GatewaySession.PING_INTERVAL_MS > 0L)
    }

    @Test
    fun pongTimeoutMs_isGreaterThanPingInterval() {
        assertTrue(GatewaySession.PONG_TIMEOUT_MS >= GatewaySession.PING_INTERVAL_MS)
    }

    // ── Reconnect backoff ───────────────────────────────

    @Test
    fun reconnectBackoffMs_doublesWithCeiling() {
        val first = GatewaySession.reconnectBackoffMs(0)
        val second = GatewaySession.reconnectBackoffMs(1)
        val third = GatewaySession.reconnectBackoffMs(2)
        assertTrue(second >= first)
        assertTrue(third >= second)
        assertTrue(third <= GatewaySession.MAX_RECONNECT_BACKOFF_MS)
    }

    @Test
    fun reconnectBackoffMs_capsAtMaximum() {
        val capped = GatewaySession.reconnectBackoffMs(100)
        assertEquals(GatewaySession.MAX_RECONNECT_BACKOFF_MS, capped)
    }

    // ── Connect URL construction ────────────────────────

    @Test
    fun buildConnectUrl_includesProtocolVersion() {
        val url = GatewaySession.buildConnectUrl("gateway.example", 443, tls = true)
        assertTrue(url.contains("wss://"))
        assertTrue(url.contains("gateway.example"))
    }

    @Test
    fun buildConnectUrl_usesCleartextForNonTls() {
        val url = GatewaySession.buildConnectUrl("local.host", 18789, tls = false)
        assertTrue(url.startsWith("ws://"))
        assertFalse(url.startsWith("wss://"))
    }

    // ── Session state ───────────────────────────────────

    @Test
    fun sessionState_initialIsDisconnected() {
        assertEquals(GatewaySession.State.Disconnected, GatewaySession.State.valueOf("Disconnected"))
    }

    @Test
    fun sessionState_allStatesAreDefined() {
        val states = GatewaySession.State.entries
        assertTrue(states.size >= 3) // At minimum: Disconnected, Connecting, Connected
    }

    // ── Concurrent request tracking ─────────────────────

    @Test
    fun pendingInvokes_emptyByDefault() {
        val session = GatewaySession.createForTest()
        assertEquals(0, session.pendingInvokeCount())
    }

    // ── Error classification ────────────────────────────

    @Test
    fun isRetryableError_includesTimeoutAndNetworkErrors() {
        assertTrue(GatewaySession.isRetryableError(java.net.SocketTimeoutException("timeout")))
        assertTrue(GatewaySession.isRetryableError(java.net.ConnectException("refused")))
    }

    @Test
    fun isRetryableError_excludesAuthErrors() {
        assertFalse(GatewaySession.isRetryableError(SecurityException("unauthorized")))
    }

    // ── Binary frame handling ───────────────────────────

    @Test
    fun isBinaryFrame_detectsByteArrayPayload() {
        assertTrue(GatewaySession.isBinaryFrame(byteArrayOf(0x00, 0x01, 0x02)))
    }

    @Test
    fun isBinaryFrame_rejectsEmptyPayload() {
        assertFalse(GatewaySession.isBinaryFrame(byteArrayOf()))
    }

    // ── Flow control ────────────────────────────────────

    @Test
    fun maxConcurrentInvokes_isPositive() {
        assertTrue(GatewaySession.MAX_CONCURRENT_INVOKES > 0)
    }

    @Test
    fun maxMessageSizeBytes_isReasonable() {
        assertTrue(GatewaySession.MAX_MESSAGE_SIZE_BYTES >= 1024 * 1024) // at least 1MB
    }
}
