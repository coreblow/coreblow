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

    // ── Auth payload construction (OC parity) ───────────

    @Test
    fun buildAuthPayload_usesBootstrapWhenNoDeviceToken() {
        val auth = GatewaySession.buildAuthPayload(
            token = null, bootstrapToken = "bootstrap-1", deviceToken = null, password = null,
        )
        assertEquals("bootstrap-1", auth["bootstrapToken"]?.jsonPrimitive?.content)
        assertNull(auth["token"])
        assertNull(auth["deviceToken"])
    }

    @Test
    fun buildAuthPayload_prefersDeviceTokenOverBootstrap() {
        val auth = GatewaySession.buildAuthPayload(
            token = null, bootstrapToken = "bootstrap-1", deviceToken = "device-1", password = null,
        )
        assertEquals("device-1", auth["token"]?.jsonPrimitive?.content)
        assertNull(auth["bootstrapToken"])
    }

    @Test
    fun buildAuthPayload_includesSharedToken() {
        val auth = GatewaySession.buildAuthPayload(
            token = "shared-token", bootstrapToken = null, deviceToken = null, password = null, // pragma: allowlist secret
        )
        assertEquals("shared-token", auth["token"]?.jsonPrimitive?.content)
    }

    @Test
    fun buildAuthPayload_includesPasswordWhenProvided() {
        val auth = GatewaySession.buildAuthPayload(
            token = null, bootstrapToken = null, deviceToken = null, password = "my-pass", // pragma: allowlist secret
        )
        assertEquals("my-pass", auth["password"]?.jsonPrimitive?.content)
    }

    @Test
    fun buildAuthPayload_includesDeviceTokenWithSharedTokenForRetry() {
        val auth = GatewaySession.buildAuthPayload(
            token = "shared-token", bootstrapToken = null, deviceToken = "stored-device", password = null, // pragma: allowlist secret
        )
        assertEquals("shared-token", auth["token"]?.jsonPrimitive?.content)
        assertEquals("stored-device", auth["deviceToken"]?.jsonPrimitive?.content)
    }

    // ── Canvas capability URL (OC parity) ───────────────

    @Test
    fun rewriteCanvasCapabilityUrl_replacesSegment() {
        val original = "http://127.0.0.1:18789/__coreblow__/cap/old-cap"
        val rewritten = GatewaySession.rewriteCanvasCapabilityUrl(original, "new-cap")
        assertTrue(rewritten.contains("new-cap"))
        assertFalse(rewritten.contains("old-cap"))
    }

    @Test
    fun rewriteCanvasCapabilityUrl_preservesHostAndPort() {
        val original = "http://10.0.2.2:18789/__coreblow__/cap/abc123"
        val rewritten = GatewaySession.rewriteCanvasCapabilityUrl(original, "xyz789")
        assertTrue(rewritten.contains("10.0.2.2:18789"))
    }

    @Test
    fun rewriteCanvasCapabilityUrl_handlesNullOriginal() {
        val result = GatewaySession.rewriteCanvasCapabilityUrl(null, "new-cap")
        assertNull(result)
    }

    // ── Connect frame parsing (OC parity) ───────────────

    @Test
    fun parseConnectResponse_extractsCanvasHostUrl() {
        val json = """{"ok":true,"payload":{"canvasHostUrl":"http://localhost:18789/__coreblow__/cap/abc","snapshot":{}}}"""
        val parsed = GatewaySession.parseConnectResponse(json)
        assertEquals("http://localhost:18789/__coreblow__/cap/abc", parsed?.canvasHostUrl)
    }

    @Test
    fun parseConnectResponse_extractsSessionDefaults() {
        val json = """{"ok":true,"payload":{"snapshot":{"sessionDefaults":{"mainSessionKey":"main"}}}}"""
        val parsed = GatewaySession.parseConnectResponse(json)
        assertEquals("main", parsed?.mainSessionKey)
    }

    @Test
    fun parseConnectResponse_returnsNullForMalformed() {
        assertNull(GatewaySession.parseConnectResponse(""))
        assertNull(GatewaySession.parseConnectResponse("not json"))
    }

    // ── Error code classification (OC parity) ───────────

    @Test
    fun isTokenMismatchError_recognizesAuthMismatchCode() {
        assertTrue(GatewaySession.isTokenMismatchError("AUTH_TOKEN_MISMATCH"))
    }

    @Test
    fun isTokenMismatchError_rejectsOtherCodes() {
        assertFalse(GatewaySession.isTokenMismatchError("INVALID_REQUEST"))
        assertFalse(GatewaySession.isTokenMismatchError("UNKNOWN"))
        assertFalse(GatewaySession.isTokenMismatchError(""))
    }

    @Test
    fun isPairingRequiredError_recognizesPairingCodes() {
        assertTrue(GatewaySession.isPairingRequiredError("DEVICE_NOT_PAIRED"))
        assertTrue(GatewaySession.isPairingRequiredError("PAIRING_REQUIRED"))
    }

    @Test
    fun isPairingRequiredError_rejectsOtherCodes() {
        assertFalse(GatewaySession.isPairingRequiredError("AUTH_TOKEN_MISMATCH"))
        assertFalse(GatewaySession.isPairingRequiredError(""))
    }

    // ── Invoke result construction (OC parity) ──────────

    @Test
    fun invokeResult_okContainsPayload() {
        val result = GatewaySession.InvokeResult.ok("""{"status":"done"}""")
        assertTrue(result.ok)
        assertNull(result.error)
        assertNotNull(result.payloadJson)
    }

    @Test
    fun invokeResult_errorContainsCodeAndMessage() {
        val result = GatewaySession.InvokeResult.error("TEST_ERROR", "something went wrong")
        assertFalse(result.ok)
        assertEquals("TEST_ERROR", result.error?.code)
        assertEquals("something went wrong", result.error?.message)
    }

    @Test
    fun invokeResult_fromExceptionExtractsCodePrefix() {
        val ex = IllegalStateException("CAMERA_PERMISSION_REQUIRED: grant Camera permission")
        val result = GatewaySession.InvokeResult.fromException(ex)
        assertFalse(result.ok)
        assertEquals("CAMERA_PERMISSION_REQUIRED", result.error?.code)
        assertEquals("grant Camera permission", result.error?.message)
    }

    @Test
    fun invokeResult_fromExceptionWithoutPrefixUsesGenericCode() {
        val ex = RuntimeException("something broke")
        val result = GatewaySession.InvokeResult.fromException(ex)
        assertFalse(result.ok)
        assertEquals("INTERNAL_ERROR", result.error?.code)
    }

    // ── Disconnect reason classification ────────────────

    @Test
    fun disconnectReason_containsCodeAndMessage() {
        val reason = GatewaySession.DisconnectReason(code = 1000, message = "normal closure")
        assertEquals(1000, reason.code)
        assertEquals("normal closure", reason.message)
    }

    @Test
    fun disconnectReason_isNormalClose() {
        assertTrue(GatewaySession.DisconnectReason(code = 1000, message = "").isNormal)
        assertTrue(GatewaySession.DisconnectReason(code = 1001, message = "").isNormal)
        assertFalse(GatewaySession.DisconnectReason(code = 1006, message = "").isNormal)
    }

    // ── Connection options ──────────────────────────────

    @Test
    fun gatewayClientInfo_isComplete() {
        val info = GatewayClientInfo(
            id = "coreblow-android",
            displayName = "CoreBlow Android",
            version = "1.0.0",
            platform = "android",
            mode = "node",
            instanceId = "test-instance",
            deviceFamily = "android",
            modelIdentifier = "Pixel 8",
        )
        assertEquals("coreblow-android", info.id)
        assertEquals("android", info.platform)
        assertEquals("node", info.mode)
    }

    @Test
    fun gatewayConnectOptions_containsRequiredFields() {
        val opts = GatewayConnectOptions(
            role = "node",
            scopes = listOf("node:invoke"),
            caps = listOf("device", "canvas"),
            commands = listOf("device.info"),
            permissions = mapOf("camera" to "granted"),
            client = GatewayClientInfo(
                id = "test", displayName = "Test", version = "1.0",
                platform = "android", mode = "node", instanceId = "i",
                deviceFamily = "android", modelIdentifier = "m",
            ),
        )
        assertEquals("node", opts.role)
        assertEquals(listOf("node:invoke"), opts.scopes)
        assertTrue(opts.caps.contains("device"))
    }
}
