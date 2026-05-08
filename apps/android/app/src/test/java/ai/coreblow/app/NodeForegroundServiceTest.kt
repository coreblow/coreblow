package ai.coreblow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NodeForegroundServiceTest {
    @Test
    fun notificationChannelId_isStable() {
        assertEquals("coreblow_foreground", NodeForegroundService.CHANNEL_ID)
    }

    @Test
    fun notificationId_isPositive() {
        assertTrue(NodeForegroundService.NOTIFICATION_ID > 0)
    }

    @Test
    fun wakeLockTag_isNonEmpty() {
        val tag = NodeForegroundService.WAKE_LOCK_TAG
        assertNotNull(tag)
        assertFalse(tag.isEmpty())
    }

    @Test
    fun defaultTimeoutMs_isReasonable() {
        val timeout = NodeForegroundService.DEFAULT_TIMEOUT_MS
        assertTrue(timeout >= 60_000L)
        assertTrue(timeout <= 600_000L)
    }

    @Test
    fun serviceActionStrings_areDistinct() {
        val actions = setOf(
            NodeForegroundService.ACTION_START,
            NodeForegroundService.ACTION_STOP,
        )
        assertEquals(2, actions.size)
    }
}
