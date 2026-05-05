package ai.coreblow.app.node.handlers

import android.content.ContentValues
import android.content.Context
import android.provider.CalendarContract
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.Calendar
import java.util.TimeZone

class CalendarHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_CALENDAR

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "list-events" -> listEvents(params)
            "create-event" -> createEvent(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun listEvents(params: JsonObject): JsonElement {
        val daysAhead = params["days"]?.jsonPrimitive?.content?.toIntOrNull() ?: 7
        val now = System.currentTimeMillis()
        val end = now + (daysAhead.toLong() * 24 * 60 * 60 * 1000)

        val events = buildJsonArray {
            val cursor = context.contentResolver.query(
                CalendarContract.Events.CONTENT_URI,
                arrayOf(
                    CalendarContract.Events._ID,
                    CalendarContract.Events.TITLE,
                    CalendarContract.Events.DTSTART,
                    CalendarContract.Events.DTEND,
                    CalendarContract.Events.EVENT_LOCATION,
                ),
                "${CalendarContract.Events.DTSTART} >= ? AND ${CalendarContract.Events.DTSTART} <= ?",
                arrayOf(now.toString(), end.toString()),
                "${CalendarContract.Events.DTSTART} ASC",
            )

            cursor?.use {
                while (it.moveToNext()) {
                    add(buildJsonObject {
                        put("id", it.getString(0))
                        put("title", it.getString(1) ?: "")
                        put("startTime", it.getLong(2))
                        put("endTime", it.getLong(3))
                        put("location", it.getString(4) ?: "")
                    })
                }
            }
        }

        return buildJsonObject {
            put("events", events)
            put("count", events.size)
        }
    }

    private fun createEvent(params: JsonObject): JsonElement {
        val title = params["title"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'title' parameter")
        val startTime = params["startTime"]?.jsonPrimitive?.content?.toLongOrNull()
            ?: throw IllegalArgumentException("Missing 'startTime' parameter")
        val endTime = params["endTime"]?.jsonPrimitive?.content?.toLongOrNull()
            ?: (startTime + 3600000)
        val location = params["location"]?.jsonPrimitive?.content

        val values = ContentValues().apply {
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DTSTART, startTime)
            put(CalendarContract.Events.DTEND, endTime)
            location?.let { put(CalendarContract.Events.EVENT_LOCATION, it) }
            put(CalendarContract.Events.CALENDAR_ID, 1)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }

        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
        val eventId = uri?.lastPathSegment

        return buildJsonObject {
            put("id", eventId ?: "")
            put("created", eventId != null)
        }
    }
}
