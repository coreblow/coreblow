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

    // ── Listener service tests (OC parity) ──────────────

    @Test fun sanitizeText_trimAndCap() {
        val long = "A".repeat(1000)
        val sanitized = sanitizeNotificationText(long)
        assertNotNull(sanitized)
        assertTrue(sanitized!!.length <= 512)
    }

    @Test fun sanitizeText_nullReturnsNull() {
        val result = sanitizeNotificationText(null)
        assertEquals(null, result)
    }

    @Test fun sanitizeText_emptyReturnsNull() {
        val result = sanitizeNotificationText("")
        assertEquals(null, result)
    }

    @Test fun sanitizeText_whitespaceOnlyReturnsNull() {
        val result = sanitizeNotificationText("   ")
        assertEquals(null, result)
    }

    @Test fun notificationEntry_toJson_containsRequiredFields() {
        val entry = DeviceNotificationEntry(
            key = "key-1", packageName = "com.test",
            title = "Title", text = "Body", subText = null,
            category = "msg", channelId = "chat",
            postTimeMs = 123456789L, isOngoing = false, isClearable = true,
        )
        val json = entry.toJsonObject()
        assertEquals("key-1", json["key"]?.jsonPrimitive?.content)
        assertEquals("com.test", json["packageName"]?.jsonPrimitive?.content)
        assertEquals("Title", json["title"]?.jsonPrimitive?.content)
        assertEquals("Body", json["text"]?.jsonPrimitive?.content)
        assertEquals(true, json["isClearable"]?.jsonPrimitive?.content?.toBooleanStrict())
    }

    @Test fun notificationEntry_toJson_omitsNullFields() {
        val entry = DeviceNotificationEntry(
            key = "key-2", packageName = "com.test",
            title = null, text = null, subText = null,
            category = null, channelId = null,
            postTimeMs = 100L, isOngoing = true, isClearable = false,
        )
        val json = entry.toJsonObject()
        assertFalse(json.containsKey("title"))
        assertFalse(json.containsKey("text"))
        assertFalse(json.containsKey("category"))
    }

    @Test fun notificationSnapshot_containsEnabledFlag() {
        val snap = DeviceNotificationSnapshot(
            enabled = true, connected = false, notifications = emptyList(),
        )
        assertTrue(snap.enabled)
        assertFalse(snap.connected)
        assertEquals(0, snap.notifications.size)
    }

    @Test fun actionKind_allValuesExist() {
        val kinds = NotificationActionKind.entries
        assertTrue(kinds.contains(NotificationActionKind.Open))
        assertTrue(kinds.contains(NotificationActionKind.Dismiss))
        assertTrue(kinds.contains(NotificationActionKind.Reply))
    }

    @Test fun actionRequiresClearable_onlyForDismiss() {
        assertTrue(actionRequiresClearableNotification(NotificationActionKind.Dismiss))
        assertFalse(actionRequiresClearableNotification(NotificationActionKind.Open))
        assertFalse(actionRequiresClearableNotification(NotificationActionKind.Reply))
    }

    @Test fun actionResult_okHasNoError() {
        val result = NotificationActionResult(ok = true)
        assertTrue(result.ok)
        assertEquals(null, result.code)
    }

    @Test fun actionResult_errorHasCodeAndMessage() {
        val result = NotificationActionResult(ok = false, code = "NOT_FOUND", message = "notification not found")
        assertFalse(result.ok)
        assertEquals("NOT_FOUND", result.code)
    }

    @Test fun actionRequest_openKind() {
        val req = NotificationActionRequest(key = "k1", kind = NotificationActionKind.Open)
        assertEquals("k1", req.key)
        assertEquals(NotificationActionKind.Open, req.kind)
    }

    @Test fun actionRequest_replyIncludesText() {
        val req = NotificationActionRequest(key = "k2", kind = NotificationActionKind.Reply, replyText = "Hello!")
        assertEquals("Hello!", req.replyText)
    }

    @Test fun historyBuffer_oldestIsEvicted() {
        val buffer = NotificationsHandler.NotificationHistoryBuffer(maxSize = 3)
        buffer.add("a"); buffer.add("b"); buffer.add("c"); buffer.add("d")
        assertEquals(3, buffer.size())
        assertFalse(buffer.contains("a"))
        assertTrue(buffer.contains("d"))
    }

    @Test fun parseShowRequest_emptyJsonReturnsNull() {
        val req = NotificationsHandler.parseShowRequest("")
        assertEquals(null, req)
    }

    @Test fun parseShowRequest_missingTitleReturnsNull() {
        val req = NotificationsHandler.parseShowRequest("""{"body":"B"}""")
        assertTrue(req == null || req.title.isNullOrBlank())
    }

    @Test fun priorityMapping_minPriority() {
        assertEquals(NotificationsHandler.Priority.Min, NotificationsHandler.parsePriority("min"))
    }
}
