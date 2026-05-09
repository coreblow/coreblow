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

    @Test fun parseCallType_mapsVoicemail() {
        assertEquals(CallLogHandler.CallType.Voicemail, CallLogHandler.parseCallType(4))
    }

    @Test fun parseCallType_mapsRejected() {
        assertEquals(CallLogHandler.CallType.Rejected, CallLogHandler.parseCallType(5))
    }

    @Test fun parseCallType_mapsBlocked() {
        assertEquals(CallLogHandler.CallType.Blocked, CallLogHandler.parseCallType(6))
    }

    @Test fun filterByType_incoming() {
        val entries = listOf(
            CallLogHandler.CallEntry(number = "+111", type = CallLogHandler.CallType.Incoming, durationSeconds = 60L, dateMs = 1000L, name = null),
            CallLogHandler.CallEntry(number = "+222", type = CallLogHandler.CallType.Outgoing, durationSeconds = 30L, dateMs = 2000L, name = null),
            CallLogHandler.CallEntry(number = "+333", type = CallLogHandler.CallType.Incoming, durationSeconds = 90L, dateMs = 3000L, name = null),
        )
        val incoming = CallLogHandler.filterByCallType(entries, CallLogHandler.CallType.Incoming)
        assertEquals(2, incoming.size)
    }

    @Test fun filterByType_missed() {
        val entries = listOf(
            CallLogHandler.CallEntry(number = "+111", type = CallLogHandler.CallType.Missed, durationSeconds = 0L, dateMs = 1000L, name = null),
            CallLogHandler.CallEntry(number = "+222", type = CallLogHandler.CallType.Incoming, durationSeconds = 60L, dateMs = 2000L, name = null),
        )
        val missed = CallLogHandler.filterByCallType(entries, CallLogHandler.CallType.Missed)
        assertEquals(1, missed.size)
        assertEquals("+111", missed[0].number)
    }

    @Test fun filterByDateRange_includesInRange() {
        val entries = listOf(
            CallLogHandler.CallEntry(number = "+111", type = CallLogHandler.CallType.Incoming, durationSeconds = 60L, dateMs = 500L, name = null),
            CallLogHandler.CallEntry(number = "+222", type = CallLogHandler.CallType.Incoming, durationSeconds = 60L, dateMs = 1500L, name = null),
            CallLogHandler.CallEntry(number = "+333", type = CallLogHandler.CallType.Incoming, durationSeconds = 60L, dateMs = 2500L, name = null),
        )
        val filtered = CallLogHandler.filterByDateRange(entries, startMs = 1000L, endMs = 2000L)
        assertEquals(1, filtered.size)
        assertEquals("+222", filtered[0].number)
    }

    @Test fun maxEntriesPerQuery_isReasonable() {
        assertTrue(CallLogHandler.MAX_ENTRIES_PER_QUERY > 0)
        assertTrue(CallLogHandler.MAX_ENTRIES_PER_QUERY <= 500)
    }

    @Test fun formatDuration_handlesHoursAndMinutes() {
        assertEquals("2h 30m 0s", CallLogHandler.formatDuration(9000L))
    }

    @Test fun durationStats_singleEntry() {
        val stats = CallLogHandler.computeDurationStats(listOf(45L))
        assertEquals(45L, stats.totalSeconds)
        assertEquals(45L, stats.averageSeconds)
        assertEquals(45L, stats.maxSeconds)
        assertEquals(45L, stats.minSeconds)
    }

    @Test fun searchByContact_caseInsensitive() {
        assertTrue(CallLogHandler.matchesContact("+12345678", "ALICE", "alice"))
        assertTrue(CallLogHandler.matchesContact("+12345678", "alice", "ALICE"))
    }

    @Test fun callTypeLabel_allTypes() {
        assertEquals("incoming", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Incoming))
        assertEquals("outgoing", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Outgoing))
        assertEquals("missed", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Missed))
        assertEquals("voicemail", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Voicemail))
        assertEquals("rejected", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Rejected))
        assertEquals("blocked", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Blocked))
        assertEquals("unknown", CallLogHandler.callTypeLabel(CallLogHandler.CallType.Unknown))
    }
}
