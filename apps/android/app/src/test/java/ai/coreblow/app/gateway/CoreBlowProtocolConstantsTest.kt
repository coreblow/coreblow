package ai.coreblow.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreBlowProtocolConstantsTest {

    @Test
    fun `protocol version is positive integer`() {
        assertTrue(CoreBlowProtocol.PROTOCOL_VERSION > 0)
    }

    @Test
    fun `all capabilities list contains expected entries`() {
        val caps = CoreBlowProtocol.ALL_CAPABILITIES
        assertTrue(caps.contains(CoreBlowProtocol.CAP_CAMERA))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_CONTACTS))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_LOCATION))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_SMS))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_DEVICE))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_SYSTEM))
    }

    @Test
    fun `all capabilities are unique`() {
        val caps = CoreBlowProtocol.ALL_CAPABILITIES
        assertEquals(caps.size, caps.distinct().size)
    }

    @Test
    fun `message types are non-empty strings`() {
        listOf(
            CoreBlowProtocol.MSG_HELLO,
            CoreBlowProtocol.MSG_AUTH,
            CoreBlowProtocol.MSG_INVOKE,
            CoreBlowProtocol.MSG_RESULT,
            CoreBlowProtocol.MSG_ERROR,
            CoreBlowProtocol.MSG_PING,
            CoreBlowProtocol.MSG_PONG,
        ).forEach { assertTrue("Message type should not be blank", it.isNotBlank()) }
    }

    @Test
    fun `role node is lowercase`() {
        assertEquals("node", CoreBlowProtocol.ROLE_NODE)
    }

    @Test
    fun `platform is android`() {
        assertEquals("android", CoreBlowProtocol.PLATFORM_ANDROID)
    }
}
