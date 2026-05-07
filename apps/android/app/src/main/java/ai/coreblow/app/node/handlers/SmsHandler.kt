package ai.coreblow.app.node.handlers

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.telephony.SmsManager as AndroidSmsManager
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.serialization.json.*

/**
 * Handles SMS-related gateway invoke commands.
 * Supports reading inbox/sent/draft messages, sending SMS,
 * searching messages, and getting conversation threads.
 */
class SmsHandler(private val context: Context) {

    companion object {
        private const val TAG = "SmsHandler"
        private const val DEFAULT_LIMIT = 20
        private const val MAX_LIMIT = 100
        private val SMS_COLUMNS = arrayOf("_id", "address", "body", "date", "type", "read", "thread_id")
    }

    /**
     * Read SMS messages from inbox.
     */
    fun readInbox(limit: Int = DEFAULT_LIMIT, offset: Int = 0, address: String? = null): String {
        return readMessages("content://sms/inbox", limit, offset, address)
    }

    /**
     * Read sent SMS messages.
     */
    fun readSent(limit: Int = DEFAULT_LIMIT, offset: Int = 0): String {
        return readMessages("content://sms/sent", limit, offset, null)
    }

    /**
     * Read draft SMS messages.
     */
    fun readDrafts(limit: Int = DEFAULT_LIMIT): String {
        return readMessages("content://sms/draft", limit, 0, null)
    }

    /**
     * Search SMS messages by keyword.
     */
    fun search(query: String, limit: Int = DEFAULT_LIMIT): String {
        if (!hasReadPermission()) return errorJson("SMS read permission not granted")
        if (query.isBlank()) return errorJson("Search query is required")

        return buildJsonObject {
            val messages = buildJsonArray {
                val cursor = context.contentResolver.query(
                    Uri.parse("content://sms"),
                    SMS_COLUMNS,
                    "body LIKE ?",
                    arrayOf("%$query%"),
                    "date DESC",
                )
                cursor?.use { c ->
                    var count = 0
                    while (c.moveToNext() && count < limit.coerceAtMost(MAX_LIMIT)) {
                        add(cursorToMessage(c))
                        count++
                    }
                }
            }
            put("messages", messages)
            put("query", query)
            put("count", messages.size)
        }.toString()
    }

    /**
     * Get conversation threads (grouped by address).
     */
    fun getThreads(limit: Int = 20): String {
        if (!hasReadPermission()) return errorJson("SMS read permission not granted")

        return buildJsonObject {
            val threads = buildJsonArray {
                val cursor = context.contentResolver.query(
                    Uri.parse("content://sms"),
                    arrayOf("thread_id", "address", "body", "date", "COUNT(*) as msg_count"),
                    "1=1) GROUP BY (thread_id",
                    null,
                    "date DESC",
                )
                cursor?.use { c ->
                    var count = 0
                    while (c.moveToNext() && count < limit) {
                        add(buildJsonObject {
                            put("threadId", c.getString(0) ?: "")
                            put("address", c.getString(1) ?: "")
                            put("lastMessage", c.getString(2) ?: "")
                            put("date", c.getLong(3))
                        })
                        count++
                    }
                }
            }
            put("threads", threads)
            put("count", threads.size)
        }.toString()
    }

    /**
     * Send an SMS message.
     */
    fun sendSms(to: String, body: String): String {
        if (to.isBlank()) return errorJson("Recipient 'to' is required")
        if (body.isBlank()) return errorJson("Message 'body' is required")

        if (!hasSendPermission()) return errorJson("SMS send permission not granted")

        return try {
            val smsManager = context.getSystemService(AndroidSmsManager::class.java)

            // Handle long messages by splitting
            if (body.length > 160) {
                val parts = smsManager.divideMessage(body)
                smsManager.sendMultipartTextMessage(to, null, parts, null, null)
                Log.i(TAG, "Sent multipart SMS (${ parts.size} parts) to $to")
            } else {
                smsManager.sendTextMessage(to, null, body, null, null)
                Log.i(TAG, "Sent SMS to $to")
            }

            buildJsonObject {
                put("success", true)
                put("to", to)
                put("length", body.length)
                put("multipart", body.length > 160)
                put("timestampMs", System.currentTimeMillis())
            }.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send SMS: ${e.message}")
            errorJson("Failed to send SMS: ${e.message}")
        }
    }

    /**
     * Get message count by type.
     */
    fun getMessageCount(): String {
        if (!hasReadPermission()) return errorJson("SMS read permission not granted")

        val inboxCount = countMessages("content://sms/inbox")
        val sentCount = countMessages("content://sms/sent")
        val draftCount = countMessages("content://sms/draft")

        return buildJsonObject {
            put("inbox", inboxCount)
            put("sent", sentCount)
            put("drafts", draftCount)
            put("total", inboxCount + sentCount + draftCount)
        }.toString()
    }

    /**
     * Get a single message by ID.
     */
    fun getMessageById(id: String): String {
        if (!hasReadPermission()) return errorJson("SMS read permission not granted")

        val cursor = context.contentResolver.query(
            Uri.parse("content://sms"),
            SMS_COLUMNS,
            "_id = ?",
            arrayOf(id),
            null,
        )

        return cursor?.use { c ->
            if (c.moveToFirst()) cursorToMessage(c).toString()
            else errorJson("Message not found: $id")
        } ?: errorJson("Failed to query message")
    }

    // MARK: - Private

    private fun readMessages(uri: String, limit: Int, offset: Int, address: String?): String {
        if (!hasReadPermission()) return errorJson("SMS read permission not granted")

        val effectiveLimit = limit.coerceIn(1, MAX_LIMIT)

        return buildJsonObject {
            val messages = buildJsonArray {
                val selection = address?.let { "address = ?" }
                val selectionArgs = address?.let { arrayOf(it) }

                val cursor = context.contentResolver.query(
                    Uri.parse(uri),
                    SMS_COLUMNS,
                    selection,
                    selectionArgs,
                    "date DESC",
                )
                cursor?.use { c ->
                    // Skip offset
                    repeat(offset) { if (!c.moveToNext()) return@use }

                    var count = 0
                    while (c.moveToNext() && count < effectiveLimit) {
                        add(cursorToMessage(c))
                        count++
                    }
                }
            }
            put("messages", messages)
            put("count", messages.size)
            put("limit", effectiveLimit)
            put("offset", offset)
        }.toString()
    }

    private fun cursorToMessage(cursor: Cursor): JsonObject {
        return buildJsonObject {
            put("id", cursor.getString(0) ?: "")
            put("address", cursor.getString(1) ?: "")
            put("body", cursor.getString(2) ?: "")
            put("date", cursor.getLong(3))
            put("type", smsTypeLabel(cursor.getInt(4)))
            put("read", cursor.getInt(5) == 1)
            put("threadId", cursor.getString(6) ?: "")
        }
    }

    private fun smsTypeLabel(type: Int): String = when (type) {
        1 -> "inbox"
        2 -> "sent"
        3 -> "draft"
        4 -> "outbox"
        5 -> "failed"
        6 -> "queued"
        else -> "unknown"
    }

    private fun countMessages(uri: String): Int {
        val cursor = context.contentResolver.query(Uri.parse(uri), arrayOf("_id"), null, null, null)
        return cursor?.use { it.count } ?: 0
    }

    private fun hasReadPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasSendPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    }

    private fun errorJson(message: String): String {
        return buildJsonObject { put("error", message) }.toString()
    }
}
