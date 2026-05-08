package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationsHandlerTest {
    @Test fun commandName_isNotifications() { assertEquals("notifications", NotificationsHandler.COMMAND_NAME) }

    @Test fun parseShowRequest_extractsRequiredFields() {
        val json = """{"title":"Test","body":"Hello world"}"""
        val req = NotificationsHandler.parseShowRequest(json)
        assertNotNull(req)
        assertEquals("Test", req?.title)
        assertEquals("Hello world", req?.body)
    }

    @Test fun parseShowRequest_handlesOptionalFields() {
        val json = """{"title":"T","body":"B","channelId":"alerts","priority":"high","tag":"t1","groupKey":"g1"}"""
        val req = NotificationsHandler.parseShowRequest(json)
        assertEquals("alerts", req?.channelId)
        assertEquals("high", req?.priority)
        assertEquals("t1", req?.tag)
        assertEquals("g1", req?.groupKey)
    }

    @Test fun parseShowRequest_handlesProgress() {
        val json = """{"title":"Download","body":"50%","progress":{"max":100,"current":50,"indeterminate":false}}"""
        val req = NotificationsHandler.parseShowRequest(json)
        assertNotNull(req?.progress)
        assertEquals(100, req?.progress?.max)
        assertEquals(50, req?.progress?.current)
        assertFalse(req?.progress?.indeterminate ?: true)
    }

    @Test fun parseShowRequest_handlesActions() {
        val json = """{"title":"T","body":"B","actions":[{"label":"Accept","id":"accept"},{"label":"Decline","id":"decline"}]}"""
        val req = NotificationsHandler.parseShowRequest(json)
        assertEquals(2, req?.actions?.size)
        assertEquals("Accept", req?.actions?.get(0)?.label)
        assertEquals("decline", req?.actions?.get(1)?.id)
    }

    @Test fun priorityMapping_mapsStringsToConstants() {
        assertEquals(NotificationsHandler.Priority.Default, NotificationsHandler.parsePriority(null))
        assertEquals(NotificationsHandler.Priority.Low, NotificationsHandler.parsePriority("low"))
        assertEquals(NotificationsHandler.Priority.High, NotificationsHandler.parsePriority("high"))
        assertEquals(NotificationsHandler.Priority.Max, NotificationsHandler.parsePriority("max"))
    }

    @Test fun priorityMapping_unknownDefaultsToDefault() {
        assertEquals(NotificationsHandler.Priority.Default, NotificationsHandler.parsePriority("invalid"))
    }

    @Test fun channelId_defaultsWhenMissing() {
        val req = NotificationsHandler.parseShowRequest("""{"title":"T","body":"B"}""")
        val channelId = NotificationsHandler.resolveChannelId(req?.channelId)
        assertNotNull(channelId)
        assertTrue(channelId.isNotEmpty())
    }

    @Test fun dismissRequest_parsesId() {
        val json = """{"notificationId":42}"""
        val req = NotificationsHandler.parseDismissRequest(json)
        assertEquals(42, req?.notificationId)
    }

    @Test fun dismissRequest_parsesTag() {
        val json = """{"tag":"my-tag"}"""
        val req = NotificationsHandler.parseDismissRequest(json)
        assertEquals("my-tag", req?.tag)
    }

    @Test fun notificationId_generatesPositiveIds() {
        val id = NotificationsHandler.generateNotificationId()
        assertTrue(id > 0)
    }

    @Test fun notificationId_generatesUniqueIds() {
        val ids = (1..100).map { NotificationsHandler.generateNotificationId() }.toSet()
        assertEquals(100, ids.size)
    }

    @Test fun historyBuffer_capsAtMaxSize() {
        val buffer = NotificationsHandler.NotificationHistoryBuffer(maxSize = 5)
        repeat(10) { buffer.add("notification-$it") }
        assertEquals(5, buffer.size())
        assertEquals("notification-9", buffer.latest())
    }

    @Test fun historyBuffer_emptyByDefault() {
        val buffer = NotificationsHandler.NotificationHistoryBuffer(maxSize = 10)
        assertEquals(0, buffer.size())
    }
}
