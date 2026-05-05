package ai.coreblow.app.gateway

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeErrorParserTest {

    @Test
    fun `parse valid error payload`() {
        val payload = buildJsonObject {
            put("code", "permission-denied")
            put("message", "Camera access not granted")
            put("detail", "User denied permission")
        }
        val error = InvokeErrorParser.parse(payload)
        assertEquals("permission-denied", error.code)
        assertEquals("Camera access not granted", error.message)
        assertEquals("User denied permission", error.detail)
        assertFalse(error.retryable)
    }

    @Test
    fun `parse null payload returns internal error`() {
        val error = InvokeErrorParser.parse(null)
        assertEquals(CoreBlowProtocol.ERR_INTERNAL, error.code)
    }

    @Test
    fun `parse non-object payload returns internal error`() {
        val error = InvokeErrorParser.parse(JsonPrimitive("just a string"))
        assertEquals(CoreBlowProtocol.ERR_INTERNAL, error.code)
    }

    @Test
    fun `timeout error is retryable`() {
        val payload = buildJsonObject {
            put("code", "timeout")
            put("message", "Command timed out")
        }
        val error = InvokeErrorParser.parse(payload)
        assertTrue(error.retryable)
    }

    @Test
    fun `internal error is retryable`() {
        val payload = buildJsonObject {
            put("code", "internal-error")
            put("message", "Something went wrong")
        }
        assertTrue(InvokeErrorParser.parse(payload).retryable)
    }

    @Test
    fun `permission error is not retryable`() {
        val payload = buildJsonObject {
            put("code", "permission-denied")
            put("message", "Access denied")
        }
        assertFalse(InvokeErrorParser.parse(payload).retryable)
    }

    @Test
    fun `missing code defaults to internal`() {
        val payload = buildJsonObject { put("message", "No code") }
        assertEquals(CoreBlowProtocol.ERR_INTERNAL, InvokeErrorParser.parse(payload).code)
    }

    @Test
    fun `missing message defaults to Unknown error`() {
        val payload = buildJsonObject { put("code", "test") }
        assertEquals("Unknown error", InvokeErrorParser.parse(payload).message)
    }

    @Test
    fun `missing detail is null`() {
        val payload = buildJsonObject { put("code", "test"); put("message", "test") }
        assertNull(InvokeErrorParser.parse(payload).detail)
    }

    @Test
    fun `localError creates non-retryable error`() {
        val error = InvokeErrorParser.localError("test-code", "test message")
        assertEquals("test-code", error.code)
        assertFalse(error.retryable)
    }

    @Test
    fun `isAuthError flag works`() {
        val error = InvokeError(code = CoreBlowProtocol.ERR_AUTH_FAILED, message = "bad auth")
        assertTrue(error.isAuthError)
        assertFalse(error.isPermissionError)
    }

    @Test
    fun `isPermissionError flag works`() {
        val error = InvokeError(code = CoreBlowProtocol.ERR_PERMISSION_DENIED, message = "denied")
        assertTrue(error.isPermissionError)
        assertFalse(error.isAuthError)
    }
}
