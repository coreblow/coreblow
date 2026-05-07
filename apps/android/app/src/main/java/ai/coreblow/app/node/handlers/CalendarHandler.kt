package ai.coreblow.app.node.handlers

import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.CalendarContract
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.TimeZone

/**
 * Reads and writes calendar events for gateway invoke commands.
 * Supports listing calendars, querying events with date range,
 * creating events, and reading event details.
 */
class CalendarHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "CalendarHandler"
        private const val DEFAULT_RANGE_MS = 30L * 24 * 60 * 60 * 1000 // 30 days
    }

    private val resolver: ContentResolver get() = appContext.contentResolver

    fun getCalendars(): String {
        val calendars = mutableListOf<JsonObject>()
        val cursor = resolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.ACCOUNT_NAME,
                CalendarContract.Calendars.ACCOUNT_TYPE,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.IS_PRIMARY,
                CalendarContract.Calendars.VISIBLE,
                CalendarContract.Calendars.OWNER_ACCOUNT,
            ),
            null, null, null,
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                calendars.add(buildJsonObject {
                    put("id", JsonPrimitive(c.getLong(0)))
                    put("name", JsonPrimitive(c.getString(1) ?: ""))
                    put("accountName", JsonPrimitive(c.getString(2) ?: ""))
                    put("accountType", JsonPrimitive(c.getString(3) ?: ""))
                    put("color", JsonPrimitive(c.getInt(4)))
                    put("isPrimary", JsonPrimitive(c.getInt(5) > 0))
                    put("visible", JsonPrimitive(c.getInt(6) > 0))
                    put("owner", JsonPrimitive(c.getString(7) ?: ""))
                })
            }
        }

        return kotlinx.serialization.json.JsonArray(calendars).toString()
    }

    fun getEvents(startMs: Long?, endMs: Long?, limit: Int = 50): String {
        val now = System.currentTimeMillis()
        val effectiveStart = startMs ?: now
        val effectiveEnd = endMs ?: (now + DEFAULT_RANGE_MS)

        val events = mutableListOf<JsonObject>()
        val cursor = resolver.query(
            CalendarContract.Events.CONTENT_URI,
            arrayOf(
                CalendarContract.Events._ID,
                CalendarContract.Events.TITLE,
                CalendarContract.Events.DESCRIPTION,
                CalendarContract.Events.DTSTART,
                CalendarContract.Events.DTEND,
                CalendarContract.Events.EVENT_LOCATION,
                CalendarContract.Events.ALL_DAY,
                CalendarContract.Events.CALENDAR_ID,
                CalendarContract.Events.STATUS,
                CalendarContract.Events.ORGANIZER,
                CalendarContract.Events.EVENT_TIMEZONE,
                CalendarContract.Events.AVAILABILITY,
                CalendarContract.Events.RRULE,
            ),
            "${CalendarContract.Events.DTSTART} >= ? AND ${CalendarContract.Events.DTSTART} <= ?",
            arrayOf(effectiveStart.toString(), effectiveEnd.toString()),
            "${CalendarContract.Events.DTSTART} ASC LIMIT $limit",
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                events.add(buildJsonObject {
                    put("id", JsonPrimitive(c.getLong(0)))
                    put("title", JsonPrimitive(c.getString(1) ?: ""))
                    put("description", JsonPrimitive((c.getString(2) ?: "").take(500)))
                    put("startMs", JsonPrimitive(c.getLong(3)))
                    put("endMs", JsonPrimitive(c.getLong(4)))
                    put("location", JsonPrimitive(c.getString(5) ?: ""))
                    put("allDay", JsonPrimitive(c.getInt(6) > 0))
                    put("calendarId", JsonPrimitive(c.getLong(7)))
                    put("status", JsonPrimitive(eventStatusLabel(c.getInt(8))))
                    put("organizer", JsonPrimitive(c.getString(9) ?: ""))
                    put("timezone", JsonPrimitive(c.getString(10) ?: TimeZone.getDefault().id))
                    put("availability", JsonPrimitive(availabilityLabel(c.getInt(11))))
                    val rrule = c.getString(12)
                    if (!rrule.isNullOrBlank()) put("rrule", JsonPrimitive(rrule))
                })
            }
        }

        return kotlinx.serialization.json.JsonArray(events).toString()
    }

    fun getEventDetail(eventId: Long): String {
        val cursor = resolver.query(
            CalendarContract.Events.CONTENT_URI,
            null,
            "${CalendarContract.Events._ID} = ?",
            arrayOf(eventId.toString()),
            null,
        )

        cursor?.use { c ->
            if (c.moveToFirst()) {
                val title = c.getString(c.getColumnIndexOrThrow(CalendarContract.Events.TITLE)) ?: ""
                val desc = c.getString(c.getColumnIndexOrThrow(CalendarContract.Events.DESCRIPTION)) ?: ""
                val start = c.getLong(c.getColumnIndexOrThrow(CalendarContract.Events.DTSTART))
                val end = c.getLong(c.getColumnIndexOrThrow(CalendarContract.Events.DTEND))
                val location = c.getString(c.getColumnIndexOrThrow(CalendarContract.Events.EVENT_LOCATION)) ?: ""
                val allDay = c.getInt(c.getColumnIndexOrThrow(CalendarContract.Events.ALL_DAY)) > 0

                // Get attendees
                val attendees = getAttendees(eventId)
                // Get reminders
                val reminders = getReminders(eventId)

                return buildJsonObject {
                    put("id", JsonPrimitive(eventId))
                    put("title", JsonPrimitive(title))
                    put("description", JsonPrimitive(desc.take(1000)))
                    put("startMs", JsonPrimitive(start))
                    put("endMs", JsonPrimitive(end))
                    put("location", JsonPrimitive(location))
                    put("allDay", JsonPrimitive(allDay))
                    put("attendees", JsonPrimitive(attendees.joinToString(";")))
                    put("reminders", JsonPrimitive(reminders.joinToString(";")))
                }.toString()
            }
        }

        return buildJsonObject { put("error", JsonPrimitive("Event not found")) }.toString()
    }

    fun createEvent(
        calendarId: Long,
        title: String,
        startMs: Long,
        endMs: Long,
        location: String? = null,
        description: String? = null,
        allDay: Boolean = false,
    ): String {
        return try {
            val values = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, calendarId)
                put(CalendarContract.Events.TITLE, title)
                put(CalendarContract.Events.DTSTART, startMs)
                put(CalendarContract.Events.DTEND, endMs)
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                put(CalendarContract.Events.ALL_DAY, if (allDay) 1 else 0)
                location?.let { put(CalendarContract.Events.EVENT_LOCATION, it) }
                description?.let { put(CalendarContract.Events.DESCRIPTION, it) }
            }
            val uri = resolver.insert(CalendarContract.Events.CONTENT_URI, values)
            val id = uri?.let { ContentUris.parseId(it) }
            buildJsonObject {
                put("success", JsonPrimitive(id != null && id > 0))
                id?.let { put("eventId", JsonPrimitive(it)) }
            }.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create event: ${e.message}")
            buildJsonObject {
                put("success", JsonPrimitive(false))
                put("error", JsonPrimitive(e.message ?: "Unknown error"))
            }.toString()
        }
    }

    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return when (subCommand) {
            "calendars" -> getCalendars()
            "events" -> {
                val startMs = (params["startMs"] as? JsonPrimitive)?.content?.toLongOrNull()
                val endMs = (params["endMs"] as? JsonPrimitive)?.content?.toLongOrNull()
                val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 50
                getEvents(startMs, endMs, limit)
            }
            "detail" -> {
                val id = (params["id"] as? JsonPrimitive)?.content?.toLongOrNull() ?: return null
                getEventDetail(id)
            }
            "create" -> {
                val calId = (params["calendarId"] as? JsonPrimitive)?.content?.toLongOrNull() ?: return null
                val title = (params["title"] as? JsonPrimitive)?.content ?: return null
                val startMs = (params["startMs"] as? JsonPrimitive)?.content?.toLongOrNull() ?: return null
                val endMs = (params["endMs"] as? JsonPrimitive)?.content?.toLongOrNull() ?: return null
                createEvent(calId, title, startMs, endMs,
                    location = (params["location"] as? JsonPrimitive)?.content,
                    description = (params["description"] as? JsonPrimitive)?.content,
                    allDay = (params["allDay"] as? JsonPrimitive)?.content?.toBoolean() == true)
            }
            else -> null
        }
    }

    // MARK: - Private

    private fun getAttendees(eventId: Long): List<String> {
        val attendees = mutableListOf<String>()
        val cursor = resolver.query(
            CalendarContract.Attendees.CONTENT_URI,
            arrayOf(CalendarContract.Attendees.ATTENDEE_EMAIL, CalendarContract.Attendees.ATTENDEE_NAME, CalendarContract.Attendees.ATTENDEE_STATUS),
            "${CalendarContract.Attendees.EVENT_ID} = ?",
            arrayOf(eventId.toString()), null,
        )
        cursor?.use {
            while (it.moveToNext()) {
                val email = it.getString(0) ?: ""
                val name = it.getString(1) ?: ""
                val status = attendeeStatusLabel(it.getInt(2))
                val label = listOf(name, email, status).filter { s -> s.isNotEmpty() }.joinToString("|")
                if (label.isNotEmpty()) attendees.add(label)
            }
        }
        return attendees
    }

    private fun getReminders(eventId: Long): List<String> {
        val reminders = mutableListOf<String>()
        val cursor = resolver.query(
            CalendarContract.Reminders.CONTENT_URI,
            arrayOf(CalendarContract.Reminders.MINUTES, CalendarContract.Reminders.METHOD),
            "${CalendarContract.Reminders.EVENT_ID} = ?",
            arrayOf(eventId.toString()), null,
        )
        cursor?.use {
            while (it.moveToNext()) {
                val mins = it.getInt(0)
                val method = reminderMethodLabel(it.getInt(1))
                reminders.add("${mins}min:$method")
            }
        }
        return reminders
    }

    private fun eventStatusLabel(status: Int): String = when (status) {
        CalendarContract.Events.STATUS_TENTATIVE -> "tentative"
        CalendarContract.Events.STATUS_CONFIRMED -> "confirmed"
        CalendarContract.Events.STATUS_CANCELED -> "cancelled"
        else -> "unknown"
    }

    private fun availabilityLabel(avail: Int): String = when (avail) {
        CalendarContract.Events.AVAILABILITY_BUSY -> "busy"
        CalendarContract.Events.AVAILABILITY_FREE -> "free"
        CalendarContract.Events.AVAILABILITY_TENTATIVE -> "tentative"
        else -> "unknown"
    }

    private fun attendeeStatusLabel(status: Int): String = when (status) {
        CalendarContract.Attendees.ATTENDEE_STATUS_ACCEPTED -> "accepted"
        CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED -> "declined"
        CalendarContract.Attendees.ATTENDEE_STATUS_TENTATIVE -> "tentative"
        CalendarContract.Attendees.ATTENDEE_STATUS_INVITED -> "invited"
        else -> "none"
    }

    private fun reminderMethodLabel(method: Int): String = when (method) {
        CalendarContract.Reminders.METHOD_ALERT -> "alert"
        CalendarContract.Reminders.METHOD_EMAIL -> "email"
        CalendarContract.Reminders.METHOD_SMS -> "sms"
        CalendarContract.Reminders.METHOD_ALARM -> "alarm"
        else -> "default"
    }
}
