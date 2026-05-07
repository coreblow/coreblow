package ai.coreblow.app.node

import android.content.Context
import android.telephony.SmsManager as AndroidSmsManager
import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Handles SMS read/send operations for the node runtime.
 * Requires SEND_SMS and READ_SMS permissions.
 */
class SmsManager(private val appContext: Context) {

    companion object {
        private const val TAG = "CoreBlowSms"
        private const val MAX_READ_RESULTS = 100
        private const val MAX_MESSAGE_LENGTH = 160
    }

    private val json = Json { ignoreUnknownKeys = true }

    fun canSendSms(): Boolean {
        return ContextCompat.checkSelfPermission(appContext, Manifest.permission.SEND_SMS) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun canReadSms(): Boolean {
        return ContextCompat.checkSelfPermission(appContext, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
    }

    suspend fun sendSms(to: String, body: String): SmsResult {
        if (!canSendSms()) return SmsResult(success = false, error = "SEND_SMS permission not granted")
        val trimmedTo = to.trim()
        val trimmedBody = body.trim()
        if (trimmedTo.isEmpty()) return SmsResult(success = false, error = "Recipient is empty")
        if (trimmedBody.isEmpty()) return SmsResult(success = false, error = "Message body is empty")

        return withContext(Dispatchers.IO) {
            try {
                val smsManager = appContext.getSystemService(AndroidSmsManager::class.java)
                    ?: return@withContext SmsResult(success = false, error = "SmsManager not available")
                if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
                    val parts = smsManager.divideMessage(trimmedBody)
                    smsManager.sendMultipartTextMessage(trimmedTo, null, parts, null, null)
                } else {
                    smsManager.sendTextMessage(trimmedTo, null, trimmedBody, null, null)
                }
                Log.i(TAG, "SMS sent to $trimmedTo")
                SmsResult(success = true)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send SMS: ${e.message}")
                SmsResult(success = false, error = e.message ?: "Unknown error")
            }
        }
    }

    suspend fun readSms(limit: Int = MAX_READ_RESULTS, filter: SmsFilter? = null): List<SmsEntry> {
        if (!canReadSms()) return emptyList()

        return withContext(Dispatchers.IO) {
            val entries = mutableListOf<SmsEntry>()
            val uri = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE,
                Telephony.Sms.READ,
            )

            val selection = buildSelection(filter)
            val selectionArgs = buildSelectionArgs(filter)
            val sortOrder = "${Telephony.Sms.DATE} DESC"
            val effectiveLimit = limit.coerceIn(1, MAX_READ_RESULTS)

            var cursor: Cursor? = null
            try {
                cursor = appContext.contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
                if (cursor == null) return@withContext entries

                var count = 0
                while (cursor.moveToNext() && count < effectiveLimit) {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID))
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: ""
                    val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
                    val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
                    val type = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE))
                    val read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.READ)) == 1

                    entries.add(SmsEntry(
                        id = id,
                        address = address,
                        body = body,
                        timestampMs = date,
                        type = smsTypeLabel(type),
                        isRead = read,
                    ))
                    count++
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to read SMS: ${e.message}")
            } finally {
                cursor?.close()
            }
            entries
        }
    }

    fun readSmsAsJson(entries: List<SmsEntry>): String {
        val array = JsonArray(entries.map { entry ->
            buildJsonObject {
                put("id", JsonPrimitive(entry.id))
                put("address", JsonPrimitive(entry.address))
                put("body", JsonPrimitive(entry.body))
                put("timestamp", JsonPrimitive(entry.timestampMs))
                put("type", JsonPrimitive(entry.type))
                put("isRead", JsonPrimitive(entry.isRead))
                put("dateFormatted", JsonPrimitive(formatTimestamp(entry.timestampMs)))
            }
        })
        return buildJsonObject { put("messages", array) }.toString()
    }

    suspend fun getConversation(address: String, limit: Int = 50): List<SmsEntry> {
        return readSms(limit = limit, filter = SmsFilter(address = address.trim()))
    }

    suspend fun getUnreadCount(): Int {
        if (!canReadSms()) return 0
        return withContext(Dispatchers.IO) {
            var cursor: Cursor? = null
            try {
                cursor = appContext.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf("count(*) AS count"),
                    "${Telephony.Sms.READ} = 0",
                    null, null,
                )
                if (cursor != null && cursor.moveToFirst()) cursor.getInt(0) else 0
            } catch (_: Exception) { 0 }
            finally { cursor?.close() }
        }
    }

    suspend fun markAsRead(id: Long): Boolean {
        if (!canReadSms()) return false
        return withContext(Dispatchers.IO) {
            try {
                val values = android.content.ContentValues().apply { put(Telephony.Sms.READ, 1) }
                val uri = Uri.withAppendedPath(Telephony.Sms.CONTENT_URI, id.toString())
                appContext.contentResolver.update(uri, values, null, null) > 0
            } catch (_: Exception) { false }
        }
    }

    // MARK: - Private

    private fun buildSelection(filter: SmsFilter?): String? {
        if (filter == null) return null
        val conditions = mutableListOf<String>()
        if (!filter.address.isNullOrBlank()) conditions.add("${Telephony.Sms.ADDRESS} = ?")
        if (filter.unreadOnly) conditions.add("${Telephony.Sms.READ} = 0")
        if (filter.sinceMs != null) conditions.add("${Telephony.Sms.DATE} > ${filter.sinceMs}")
        return if (conditions.isEmpty()) null else conditions.joinToString(" AND ")
    }

    private fun buildSelectionArgs(filter: SmsFilter?): Array<String>? {
        if (filter == null) return null
        val args = mutableListOf<String>()
        if (!filter.address.isNullOrBlank()) args.add(filter.address.trim())
        return if (args.isEmpty()) null else args.toTypedArray()
    }

    private fun smsTypeLabel(type: Int): String = when (type) {
        Telephony.Sms.MESSAGE_TYPE_INBOX -> "inbox"
        Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
        Telephony.Sms.MESSAGE_TYPE_DRAFT -> "draft"
        Telephony.Sms.MESSAGE_TYPE_OUTBOX -> "outbox"
        Telephony.Sms.MESSAGE_TYPE_FAILED -> "failed"
        else -> "unknown"
    }

    private fun formatTimestamp(ms: Long): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
            sdf.format(Date(ms))
        } catch (_: Exception) { ms.toString() }
    }
}

data class SmsResult(val success: Boolean, val error: String? = null)

data class SmsEntry(
    val id: Long,
    val address: String,
    val body: String,
    val timestampMs: Long,
    val type: String,
    val isRead: Boolean,
)

data class SmsFilter(
    val address: String? = null,
    val unreadOnly: Boolean = false,
    val sinceMs: Long? = null,
)
