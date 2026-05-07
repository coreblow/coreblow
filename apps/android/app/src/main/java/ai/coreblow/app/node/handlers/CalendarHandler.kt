package ai.coreblow.app.node.handlers

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.serialization.json.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Handles calendar-related gateway invoke commands.
 * Supports reading events, creating events, searching,
 * and retrieving calendar metadata.
 */
class CalendarHandler(private val context: Context) {

    companion object {
        private const val TAG = "CalendarHandler"
        private val DATE_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    }

    /**
     * Get upcoming events.
     */
    fun getUpcomingEvents(daysAhead: Int = 7, limit: Int = 20): String {
        if (!hasPermission()) return errorJson("Calendar permission not granted")

        val now = System.currentTimeMillis()
        val end = now + daysAhead * 24 * 60 * 60 * 1000L

        return buildJsonObject {
            val events = buildJsonArray {
                val cursor = context.contentResolver.query(
                    CalendarContract.Events.CONTENT_URI,
                    EVENT_COLUMNS,
                    "${CalendarContract.Events.DTSTART} >= ? AND ${CalendarContract.Events.DTSTART} <= ?",
                    arrayOf(now.toString(), end.toString()),
                    "${CalendarContract.Events.DTSTART} ASC",
                )
                cursor?.use { c ->
                    var count = 0
                    while (c.moveToNext() && count < limit) {
                        add(cursorToEvent(c))
                        count++
                    }
                }
            }
            put("events", events)
            put("count", events.size)
            put("daysAhead", daysAhead)
        }.toString()
    }

    /**
     * Get events for a specific date.
     */
    fun getEventsForDate(dateMs: Long): String {
        if (!hasPermission()) return errorJson("Calendar permission not granted")

        val cal = Calendar.getInstance().apply { timeInMillis = dateMs }
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0)
        val dayStart = cal.timeInMillis
        cal.add(Calendar.DAY_OF_MONTH, 1)
        val dayEnd = cal.timeInMillis

        return buildJsonObject {
            val events = buildJsonArray {
                val cursor = context.contentResolver.query(
                    CalendarContract.Events.CONTENT_URI,
                    EVENT_COLUMNS,
                    "${CalendarContract.Events.DTSTART} >= ? AND ${CalendarContract.Events.DTSTART} < ?",
                    arrayOf(dayStart.toString(), dayEnd.toString()),
                    "${CalendarContract.Events.DTSTART} ASC",
                )
                cursor?.use { c ->
                    while (c.moveToNext()) add(cursorToEvent(c))
                }
            }
            put("events", events)
            put("date", DATE_FORMAT.format(Date(dateMs)))
            put("count", events.size)
        }.toString()
    }

    /**
     * Search events by title.
     */
    fun searchEvents(query: String, limit: Int = 20): String {
        if (!hasPermission()) return errorJson("Calendar permission not granted")

        return buildJsonObject {
            val events = buildJsonArray {
                val cursor = context.contentResolver.query(
                    CalendarContract.Events.CONTENT_URI,
                    EVENT_COLUMNS,
                    "${CalendarContract.Events.TITLE} LIKE ?",
                    arrayOf("%$query%"),
                    "${CalendarContract.Events.DTSTART} DESC",
                )
                cursor?.use { c ->
                    var count = 0
                    while (c.moveToNext() && count < limit) {
                        add(cursorToEvent(c))
                        count++
                    }
                }
            }
            put("events", events)
            put("query", query)
            put("count", events.size)
        }.toString()
    }

    /**
     * Get available calendars.
     */
    fun getCalendars(): String {
        if (!hasPermission()) return errorJson("Calendar permission not granted")

        return buildJsonObject {
            val calendars = buildJsonArray {
                val cursor = context.contentResolver.query(
                    CalendarContract.Calendars.CONTENT_URI,
                    arrayOf(
                        CalendarContract.Calendars._ID,
                        CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                        CalendarContract.Calendars.ACCOUNT_NAME,
                        CalendarContract.Calendars.CALENDAR_COLOR,
                        CalendarContract.Calendars.VISIBLE,
                        CalendarContract.Calendars.IS_PRIMARY,
                    ),
                    null, null, null,
                )
                cursor?.use { c ->
                    while (c.moveToNext()) {
                        add(buildJsonObject {
                            put("id", c.getLong(0))
                            put("name", c.getString(1) ?: "")
                            put("account", c.getString(2) ?: "")
                            put("color", c.getInt(3))
                            put("visible", c.getInt(4) == 1)
                            put("isPrimary", c.getInt(5) == 1)
                        })
                    }
                }
            }
            put("calendars", calendars)
            put("count", calendars.size)
        }.toString()
    }

    /**
     * Get today's agenda summary.
     */
    fun getTodayAgenda(): String {
        return getEventsForDate(System.currentTimeMillis())
    }

    /**
     * Check if there's a conflict with a proposed time.
     */
    fun checkConflict(startMs: Long, endMs: Long): String {
        if (!hasPermission()) return errorJson("Calendar permission not granted")

        val cursor = context.contentResolver.query(
            CalendarContract.Events.CONTENT_URI,
            arrayOf(CalendarContract.Events._ID, CalendarContract.Events.TITLE),
            "${CalendarContract.Events.DTSTART} < ? AND ${CalendarContract.Events.DTEND} > ?",
            arrayOf(endMs.toString(), startMs.toString()),
            null,
        )

        val conflicts = mutableListOf<String>()
        cursor?.use { c ->
            while (c.moveToNext()) {
                conflicts.add(c.getString(1) ?: "Untitled")
            }
        }

        return buildJsonObject {
            put("hasConflict", conflicts.isNotEmpty())
            put("conflicts", JsonArray(conflicts.map { JsonPrimitive(it) }))
            put("conflictCount", conflicts.size)
        }.toString()
    }

    // MARK: - Private

    private val EVENT_COLUMNS = arrayOf(
        CalendarContract.Events._ID,
        CalendarContract.Events.TITLE,
        CalendarContract.Events.DESCRIPTION,
        CalendarContract.Events.DTSTART,
        CalendarContract.Events.DTEND,
        CalendarContract.Events.EVENT_LOCATION,
        CalendarContract.Events.ALL_DAY,
        CalendarContract.Events.CALENDAR_ID,
    )

    private fun cursorToEvent(c: android.database.Cursor): JsonObject {
        val startMs = c.getLong(3)
        val endMs = c.getLong(4)
        return buildJsonObject {
            put("id", c.getLong(0))
            put("title", c.getString(1) ?: "")
            put("description", c.getString(2) ?: "")
            put("startMs", startMs)
            put("endMs", endMs)
            put("start", DATE_FORMAT.format(Date(startMs)))
            put("end", if (endMs > 0) DATE_FORMAT.format(Date(endMs)) else "")
            put("location", c.getString(5) ?: "")
            put("allDay", c.getInt(6) == 1)
            put("calendarId", c.getLong(7))
            put("durationMinutes", if (endMs > startMs) ((endMs - startMs) / 60000).toInt() else 0)
        }
    }

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
    }

    private fun errorJson(message: String): String {
        return buildJsonObject { put("error", message) }.toString()
    }
}
