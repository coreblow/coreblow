package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CallLogHandlerTest {
    @Test fun commandName_isCallLog() { assertEquals("callLog", CallLogHandler.COMMAND_NAME) }

    @Test fun parseCallType_mapsIncomingCorrectly() {
        assertEquals(CallLogHandler.CallType.Incoming, CallLogHandler.parseCallType(1))
        assertEquals(CallLogHandler.CallType.Outgoing, CallLogHandler.parseCallType(2))
        assertEquals(CallLogHandler.CallType.Missed, CallLogHandler.parseCallType(3))
    }

    @Test fun parseCallType_unknownDefaultsToUnknown() {
        assertEquals(CallLogHandler.CallType.Unknown, CallLogHandler.parseCallType(999))
    }

    @Test fun formatDuration_handlesZero() {
        assertEquals("0s", CallLogHandler.formatDuration(0L))
    }

    @Test fun formatDuration_handlesMinutesAndSeconds() {
        assertEquals("1m 30s", CallLogHandler.formatDuration(90L))
        assertEquals("1h 0m 0s", CallLogHandler.formatDuration(3600L))
    }

    @Test fun parseRecentCallsResponse_handlesEmptyArray() {
        val result = CallLogHandler.parseRecentCallsResponse("[]")
        assertNotNull(result)
        assertEquals(0, result.size)
    }

    @Test fun parseCallEntry_extractsFields() {
        val json = """{"number":"+1234567890","type":1,"duration":120,"date":"2026-01-01T10:00:00Z","name":"Alice"}"""
        val entry = CallLogHandler.parseCallEntry(json)
        assertNotNull(entry)
        assertEquals("+1234567890", entry?.number)
        assertEquals("Alice", entry?.name)
        assertEquals(120L, entry?.durationSeconds)
    }

    @Test fun parseCallEntry_handlesNullName() {
        val json = """{"number":"+1234567890","type":2,"duration":60,"date":"2026-01-01T10:00:00Z"}"""
        val entry = CallLogHandler.parseCallEntry(json)
        assertNull(entry?.name)
    }

    @Test fun searchByContact_matchesPartialNumber() {
        assertTrue(CallLogHandler.matchesContact("+12345678", "2345"))
        assertFalse(CallLogHandler.matchesContact("+12345678", "9999"))
    }

    @Test fun searchByContact_matchesContactName() {
        assertTrue(CallLogHandler.matchesContact("+12345678", "1234", "Alice"))
        assertTrue(CallLogHandler.matchesContact("+12345678", "ali", "Alice"))
        assertFalse(CallLogHandler.matchesContact("+12345678", "bob", "Alice"))
    }

    @Test fun durationStats_computesAverageAndTotal() {
        val durations = listOf(60L, 120L, 180L)
        val stats = CallLogHandler.computeDurationStats(durations)
        assertEquals(360L, stats.totalSeconds)
        assertEquals(120L, stats.averageSeconds)
        assertEquals(180L, stats.maxSeconds)
        assertEquals(60L, stats.minSeconds)
    }

    @Test fun durationStats_handlesEmptyList() {
        val stats = CallLogHandler.computeDurationStats(emptyList())
        assertEquals(0L, stats.totalSeconds)
        assertEquals(0L, stats.averageSeconds)
    }

    @Test fun requiredPermissions_includesReadCallLog() {
        val perms = CallLogHandler.requiredPermissions()
        assertTrue(perms.isNotEmpty())
    }
}
