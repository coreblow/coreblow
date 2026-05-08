package ai.coreblow.app.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatControllerMessageIdentityTest {
    @Test fun generateMessageId_isNonEmpty() {
        val id = ChatController.generateMessageId()
        assertNotNull(id)
        assertTrue(id.isNotEmpty())
    }

    @Test fun generateMessageId_isUnique() {
        val ids = (1..1000).map { ChatController.generateMessageId() }.toSet()
        assertEquals(1000, ids.size)
    }

    @Test fun generateMessageId_hasExpectedFormat() {
        val id = ChatController.generateMessageId()
        // Should contain timestamp component for ordering
        assertTrue(id.length >= 8)
    }

    @Test fun messageOrdering_byTimestamp() {
        val msg1 = ChatController.createMessage(role = "user", content = "first", timestampMs = 1000L)
        val msg2 = ChatController.createMessage(role = "assistant", content = "second", timestampMs = 2000L)
        assertTrue(msg1.timestampMs < msg2.timestampMs)
    }

    @Test fun messageOrdering_stableForSameTimestamp() {
        val msg1 = ChatController.createMessage(role = "user", content = "a", timestampMs = 1000L)
        val msg2 = ChatController.createMessage(role = "user", content = "b", timestampMs = 1000L)
        // Even with same timestamp, IDs should differ
        assertNotEquals(msg1.id, msg2.id)
    }

    @Test fun messageRole_valuesAreDistinct() {
        val roles = setOf(
            ChatController.ROLE_USER,
            ChatController.ROLE_ASSISTANT,
            ChatController.ROLE_SYSTEM,
            ChatController.ROLE_TOOL,
        )
        assertEquals(4, roles.size)
    }

    @Test fun messageContent_preservesWhitespace() {
        val content = "  hello\n  world  "
        val msg = ChatController.createMessage(role = "user", content = content)
        assertEquals(content, msg.content)
    }

    @Test fun messageContent_handlesEmptyString() {
        val msg = ChatController.createMessage(role = "assistant", content = "")
        assertEquals("", msg.content)
    }
}
