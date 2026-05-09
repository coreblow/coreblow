package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarHandlerTest {
    @Test fun commandName_isCalendar() { assertEquals("calendar", CalendarHandler.COMMAND_NAME) }

    @Test fun listEvents_returnsEmptyForEmptyProvider() {
        val result = CalendarHandler.parseEventListResponse("[]")
        assertNotNull(result)
        assertEquals(0, result.size)
    }

    @Test fun parseEvent_extractsRequiredFields() {
        val json = """{"id":"1","title":"Meeting","start":"2026-01-01T10:00:00Z","end":"2026-01-01T11:00:00Z"}"""
        val event = CalendarHandler.parseEvent(json)
        assertNotNull(event)
        assertEquals("1", event?.id)
        assertEquals("Meeting", event?.title)
    }

    @Test fun parseEvent_handlesOptionalFields() {
        val json = """{"id":"2","title":"Lunch","start":"2026-01-01T12:00:00Z","end":"2026-01-01T13:00:00Z","location":"Cafe","description":"Team lunch"}"""
        val event = CalendarHandler.parseEvent(json)
        assertEquals("Cafe", event?.location)
        assertEquals("Team lunch", event?.description)
    }

    @Test fun dateRangeQuery_validatesStartBeforeEnd() {
        assertFalse(CalendarHandler.isValidDateRange("2026-12-31", "2026-01-01"))
        assertTrue(CalendarHandler.isValidDateRange("2026-01-01", "2026-12-31"))
    }

    @Test fun dateRangeQuery_rejectsInvalidFormats() {
        assertFalse(CalendarHandler.isValidDateRange("not-a-date", "2026-12-31"))
        assertFalse(CalendarHandler.isValidDateRange("2026-01-01", "invalid"))
    }

    @Test fun conflictDetection_findOverlaps() {
        val events = listOf(
            CalendarHandler.TimeSlot("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
            CalendarHandler.TimeSlot("2026-01-01T10:30:00Z", "2026-01-01T11:30:00Z"),
        )
        val conflicts = CalendarHandler.findConflicts(events)
        assertEquals(1, conflicts.size)
    }

    @Test fun conflictDetection_noOverlapsForSeparateEvents() {
        val events = listOf(
            CalendarHandler.TimeSlot("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
            CalendarHandler.TimeSlot("2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z"),
        )
        val conflicts = CalendarHandler.findConflicts(events)
        assertEquals(0, conflicts.size)
    }

    @Test fun calendarPermissions_includesReadAndWrite() {
        val perms = CalendarHandler.requiredPermissions()
        assertTrue(perms.size >= 2)
    }

    @Test fun parseEvent_handlesAllDayEvent() {
        val json = """{"id":"3","title":"Holiday","start":"2026-07-04","end":"2026-07-05","allDay":true}"""
        val event = CalendarHandler.parseEvent(json)
        assertNotNull(event)
        assertTrue(event!!.allDay)
    }

    @Test fun parseEvent_handlesRecurringRule() {
        val json = """{"id":"4","title":"Standup","start":"2026-01-01T09:00:00Z","end":"2026-01-01T09:15:00Z","rrule":"FREQ=DAILY"}"""
        val event = CalendarHandler.parseEvent(json)
        assertEquals("FREQ=DAILY", event?.rrule)
    }

    @Test fun dateRangeQuery_sameDayIsValid() {
        assertTrue(CalendarHandler.isValidDateRange("2026-06-15", "2026-06-15"))
    }

    @Test fun parseDurationMinutes_computesCorrectly() {
        val minutes = CalendarHandler.durationMinutes("2026-01-01T10:00:00Z", "2026-01-01T11:30:00Z")
        assertEquals(90L, minutes)
    }

    @Test fun parseDurationMinutes_handlesZeroDuration() {
        val minutes = CalendarHandler.durationMinutes("2026-01-01T10:00:00Z", "2026-01-01T10:00:00Z")
        assertEquals(0L, minutes)
    }

    @Test fun conflictDetection_adjacentIsNotConflict() {
        val events = listOf(
            CalendarHandler.TimeSlot("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
            CalendarHandler.TimeSlot("2026-01-01T11:00:00Z", "2026-01-01T12:00:00Z"),
        )
        val conflicts = CalendarHandler.findConflicts(events)
        assertEquals(0, conflicts.size)
    }

    @Test fun maxEventsPerQuery_isReasonable() {
        assertTrue(CalendarHandler.MAX_EVENTS_PER_QUERY > 0)
        assertTrue(CalendarHandler.MAX_EVENTS_PER_QUERY <= 1000)
    }
}
