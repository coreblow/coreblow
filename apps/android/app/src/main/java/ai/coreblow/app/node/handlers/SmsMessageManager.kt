package ai.coreblow.app.node.handlers

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.util.Log
import kotlinx.serialization.json.*

/**
 * Manages SMS message data access separate from the invoke handler.
 * Provides conversation threading, contact resolution, and
 * message statistics for the SMS subsystem.
 */
class SmsMessageManager(private val context: Context) {

    companion object {
        private const val TAG = "SmsMessageManager"
    }

    /**
     * Get conversation thread with a specific contact.
     */
    fun getThread(address: String, limit: Int = 50): List<SmsMessage> {
        val messages = mutableListOf<SmsMessage>()
        val cursor = context.contentResolver.query(
            Uri.parse("content://sms"),
            arrayOf("_id", "address", "body", "date", "type", "read"),
            "address = ?",
            arrayOf(address),
            "date DESC",
        )
        cursor?.use { c ->
            var count = 0
            while (c.moveToNext() && count < limit) {
                messages.add(cursorToSmsMessage(c))
                count++
            }
        }
        return messages
    }

    /**
     * Get unique contacts with message counts.
     */
    fun getContactSummaries(): List<SmsContactSummary> {
        val summaries = mutableMapOf<String, SmsContactSummary>()
        val cursor = context.contentResolver.query(
            Uri.parse("content://sms"),
            arrayOf("address", "body", "date", "type"),
            null, null, "date DESC",
        )
        cursor?.use { c ->
            while (c.moveToNext()) {
                val address = c.getString(0) ?: continue
                val body = c.getString(1) ?: ""
                val date = c.getLong(2)
                val type = c.getInt(3)

                val existing = summaries[address]
                if (existing == null) {
                    summaries[address] = SmsContactSummary(
                        address = address,
                        lastMessage = body,
                        lastDateMs = date,
                        inboxCount = if (type == 1) 1 else 0,
                        sentCount = if (type == 2) 1 else 0,
                    )
                } else {
                    summaries[address] = existing.copy(
                        inboxCount = existing.inboxCount + if (type == 1) 1 else 0,
                        sentCount = existing.sentCount + if (type == 2) 1 else 0,
                    )
                }
            }
        }
        return summaries.values.sortedByDescending { it.lastDateMs }
    }

    /**
     * Get unread message count.
     */
    fun getUnreadCount(): Int {
        val cursor = context.contentResolver.query(
            Uri.parse("content://sms/inbox"),
            arrayOf("_id"),
            "read = 0",
            null, null,
        )
        return cursor?.use { it.count } ?: 0
    }

    /**
     * Mark a message as read.
     */
    fun markAsRead(messageId: String): Boolean {
        return try {
            val values = android.content.ContentValues().apply { put("read", 1) }
            val updated = context.contentResolver.update(
                Uri.parse("content://sms/$messageId"),
                values, null, null,
            )
            updated > 0
        } catch (e: Exception) {
            Log.e(TAG, "Failed to mark as read: ${e.message}")
            false
        }
    }

    /**
     * Delete a message by ID.
     */
    fun deleteMessage(messageId: String): Boolean {
        return try {
            val deleted = context.contentResolver.delete(
                Uri.parse("content://sms/$messageId"),
                null, null,
            )
            deleted > 0
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete message: ${e.message}")
            false
        }
    }

    /**
     * Get messages within a date range.
     */
    fun getByDateRange(startMs: Long, endMs: Long, limit: Int = 50): List<SmsMessage> {
        val messages = mutableListOf<SmsMessage>()
        val cursor = context.contentResolver.query(
            Uri.parse("content://sms"),
            arrayOf("_id", "address", "body", "date", "type", "read"),
            "date >= ? AND date <= ?",
            arrayOf(startMs.toString(), endMs.toString()),
            "date DESC",
        )
        cursor?.use { c ->
            var count = 0
            while (c.moveToNext() && count < limit) {
                messages.add(cursorToSmsMessage(c))
                count++
            }
        }
        return messages
    }

    /**
     * Convert results to JSON string.
     */
    fun messagesToJson(messages: List<SmsMessage>): String {
        return buildJsonObject {
            put("messages", buildJsonArray {
                messages.forEach { msg ->
                    add(buildJsonObject {
                        put("id", msg.id)
                        put("address", msg.address)
                        put("body", msg.body)
                        put("dateMs", msg.dateMs)
                        put("type", msg.type)
                        put("isRead", msg.isRead)
                    })
                }
            })
            put("count", messages.size)
        }.toString()
    }

    private fun cursorToSmsMessage(c: Cursor): SmsMessage {
        return SmsMessage(
            id = c.getString(0) ?: "",
            address = c.getString(1) ?: "",
            body = c.getString(2) ?: "",
            dateMs = c.getLong(3),
            type = when (c.getInt(4)) { 1 -> "inbox"; 2 -> "sent"; 3 -> "draft"; else -> "other" },
            isRead = c.getInt(5) == 1,
        )
    }
}

data class SmsMessage(
    val id: String,
    val address: String,
    val body: String,
    val dateMs: Long,
    val type: String,
    val isRead: Boolean,
)

data class SmsContactSummary(
    val address: String,
    val lastMessage: String,
    val lastDateMs: Long,
    val inboxCount: Int,
    val sentCount: Int,
) {
    val totalCount: Int get() = inboxCount + sentCount
}
