package ai.coreblow.app.node

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.ContactsContract
import android.provider.Telephony
import android.telephony.SmsManager as AndroidSmsManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.Serializable
import ai.coreblow.app.PermissionRequester

/**
 * Sends and queries SMS messages via the Android telephony APIs.
 *
 * Requires SEND_SMS for sending, READ_SMS for searching,
 * and optionally READ_CONTACTS for contact-name-based queries.
 */
class SmsManager(private val context: Context) {

    private val json = JsonConfig
    @Volatile private var permissionRequester: PermissionRequester? = null

    // ── Data models ─────────────────────────────────────

    data class SendResult(val ok: Boolean, val to: String, val message: String?, val error: String? = null, val payloadJson: String)

    @Serializable
    data class SmsMessage(
        val id: Long,
        val threadId: Long,
        val address: String?,
        val person: String?,
        val date: Long,
        val dateSent: Long,
        val read: Boolean,
        val type: Int,
        val body: String?,
        val status: Int,
    )

    data class SearchResult(val ok: Boolean, val messages: List<SmsMessage>, val error: String? = null, val payloadJson: String)

    internal data class ParsedParams(val to: String, val message: String)

    internal sealed class ParseResult {
        data class Ok(val params: ParsedParams) : ParseResult()
        data class Error(val error: String, val to: String = "", val message: String? = null) : ParseResult()
    }

    internal data class QueryParams(
        val startTime: Long? = null,
        val endTime: Long? = null,
        val contactName: String? = null,
        val phoneNumber: String? = null,
        val keyword: String? = null,
        val type: Int? = null,
        val isRead: Boolean? = null,
        val limit: Int = DEFAULT_SMS_LIMIT,
        val offset: Int = 0,
    )

    internal sealed class QueryParseResult {
        data class Ok(val params: QueryParams) : QueryParseResult()
        data class Error(val error: String) : QueryParseResult()
    }

    internal data class SendPlan(val parts: List<String>, val useMultipart: Boolean)

    companion object {
        private const val DEFAULT_SMS_LIMIT = 25
        internal val JsonConfig = Json { ignoreUnknownKeys = true }

        internal fun parseParams(paramsJson: String?, json: Json = JsonConfig): ParseResult {
            val params = paramsJson?.trim().orEmpty()
            if (params.isEmpty()) return ParseResult.Error(error = "INVALID_REQUEST: paramsJSON required")

            val obj = try { json.parseToJsonElement(params).jsonObject } catch (_: Throwable) { null }
                ?: return ParseResult.Error(error = "INVALID_REQUEST: expected JSON object")

            val to = (obj["to"] as? JsonPrimitive)?.content?.trim().orEmpty()
            val message = (obj["message"] as? JsonPrimitive)?.content.orEmpty()

            if (to.isEmpty()) return ParseResult.Error(error = "INVALID_REQUEST: 'to' phone number required", message = message)
            if (message.isEmpty()) return ParseResult.Error(error = "INVALID_REQUEST: 'message' text required", to = to)

            return ParseResult.Ok(ParsedParams(to = to, message = message))
        }

        internal fun parseQueryParams(paramsJson: String?, json: Json = JsonConfig): QueryParseResult {
            val params = paramsJson?.trim().orEmpty()
            if (params.isEmpty()) return QueryParseResult.Ok(QueryParams())

            val obj = try { json.parseToJsonElement(params).jsonObject } catch (_: Throwable) { return QueryParseResult.Error("INVALID_REQUEST: expected JSON object") }

            val startTime = (obj["startTime"] as? JsonPrimitive)?.content?.toLongOrNull()
            val endTime = (obj["endTime"] as? JsonPrimitive)?.content?.toLongOrNull()
            val contactName = (obj["contactName"] as? JsonPrimitive)?.content?.trim()
            val phoneNumber = (obj["phoneNumber"] as? JsonPrimitive)?.content?.trim()
            val keyword = (obj["keyword"] as? JsonPrimitive)?.content?.trim()
            val type = (obj["type"] as? JsonPrimitive)?.content?.toIntOrNull()
            val isRead = (obj["isRead"] as? JsonPrimitive)?.content?.toBooleanStrictOrNull()
            val limit = ((obj["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: DEFAULT_SMS_LIMIT).coerceIn(1, 200)
            val offset = ((obj["offset"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0).coerceAtLeast(0)

            if (startTime != null && endTime != null && startTime > endTime) {
                return QueryParseResult.Error("INVALID_REQUEST: startTime must be less than or equal to endTime")
            }

            return QueryParseResult.Ok(QueryParams(startTime = startTime, endTime = endTime, contactName = contactName, phoneNumber = phoneNumber, keyword = keyword, type = type, isRead = isRead, limit = limit, offset = offset))
        }

        private fun normalizePhoneNumber(phone: String): String = phone.replace(Regex("""[\s\-()]"""), "")

        internal fun buildSendPlan(message: String, divider: (String) -> List<String>): SendPlan {
            val parts = divider(message).ifEmpty { listOf(message) }
            return SendPlan(parts = parts, useMultipart = parts.size > 1)
        }

        internal fun buildPayloadJson(json: Json = JsonConfig, ok: Boolean, to: String, error: String?): String {
            val payload = mutableMapOf<String, JsonElement>("ok" to JsonPrimitive(ok), "to" to JsonPrimitive(to))
            if (!ok) payload["error"] = JsonPrimitive(error ?: "SMS_SEND_FAILED")
            return json.encodeToString(JsonObject.serializer(), JsonObject(payload))
        }

        internal fun buildQueryPayloadJson(json: Json = JsonConfig, ok: Boolean, messages: List<SmsMessage>, error: String? = null): String {
            val messagesArray = json.encodeToString(messages)
            val messagesElement = json.parseToJsonElement(messagesArray)
            val payload = mutableMapOf<String, JsonElement>("ok" to JsonPrimitive(ok), "count" to JsonPrimitive(messages.size), "messages" to messagesElement)
            if (!ok && error != null) payload["error"] = JsonPrimitive(error)
            return json.encodeToString(JsonObject.serializer(), JsonObject(payload))
        }
    }

    // ── Permission checks ───────────────────────────────

    fun hasSmsPermission(): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    fun hasReadSmsPermission(): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    fun hasReadContactsPermission(): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    fun canSendSms(): Boolean = hasSmsPermission() && hasTelephonyFeature()
    fun canReadSms(): Boolean = hasReadSmsPermission() && hasTelephonyFeature()
    fun hasTelephonyFeature(): Boolean = context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true

    fun attachPermissionRequester(requester: PermissionRequester) { permissionRequester = requester }

    // ── Send ────────────────────────────────────────────

    suspend fun send(paramsJson: String?): SendResult {
        if (!hasTelephonyFeature()) return errorResult(error = "SMS_UNAVAILABLE: telephony not available")
        if (!ensureSmsPermission()) return errorResult(error = "SMS_PERMISSION_REQUIRED: grant SMS permission")

        val parseResult = parseParams(paramsJson, json)
        if (parseResult is ParseResult.Error) return errorResult(error = parseResult.error, to = parseResult.to, message = parseResult.message)
        val params = (parseResult as ParseResult.Ok).params

        return try {
            val smsManager = context.getSystemService(AndroidSmsManager::class.java)
                ?: throw IllegalStateException("SMS_UNAVAILABLE: SmsManager not available")
            val plan = buildSendPlan(params.message) { smsManager.divideMessage(it) }
            if (plan.useMultipart) {
                smsManager.sendMultipartTextMessage(params.to, null, ArrayList(plan.parts), null, null)
            } else {
                smsManager.sendTextMessage(params.to, null, params.message, null, null)
            }
            okResult(to = params.to, message = params.message)
        } catch (e: SecurityException) {
            errorResult(error = "SMS_PERMISSION_REQUIRED: ${e.message}", to = params.to, message = params.message)
        } catch (e: Throwable) {
            errorResult(error = "SMS_SEND_FAILED: ${e.message ?: "unknown error"}", to = params.to, message = params.message)
        }
    }

    // ── Search ──────────────────────────────────────────

    suspend fun search(paramsJson: String?): SearchResult = withContext(Dispatchers.IO) {
        if (!hasTelephonyFeature()) return@withContext searchError("SMS_UNAVAILABLE: telephony not available")
        if (!ensureReadSmsPermission()) return@withContext searchError("SMS_PERMISSION_REQUIRED: grant READ_SMS permission")

        val parseResult = parseQueryParams(paramsJson, json)
        if (parseResult is QueryParseResult.Error) return@withContext searchError(parseResult.error)
        val params = (parseResult as QueryParseResult.Ok).params

        return@withContext try {
            val phoneNumbers = if (!params.contactName.isNullOrEmpty()) {
                if (!ensureReadContactsPermission()) return@withContext searchError("CONTACTS_PERMISSION_REQUIRED: grant READ_CONTACTS permission")
                getPhoneNumbersFromContactName(params.contactName)
            } else emptyList()

            val messages = querySmsMessages(params, phoneNumbers)
            SearchResult(ok = true, messages = messages, payloadJson = buildQueryPayloadJson(json, ok = true, messages = messages))
        } catch (e: SecurityException) {
            searchError("SMS_PERMISSION_REQUIRED: ${e.message}")
        } catch (e: Throwable) {
            searchError("SMS_QUERY_FAILED: ${e.message ?: "unknown error"}")
        }
    }

    // ── Permission helpers ──────────────────────────────

    private suspend fun ensureSmsPermission(): Boolean {
        if (hasSmsPermission()) return true
        val requester = permissionRequester ?: return false
        return requester.requestIfMissing(listOf(Manifest.permission.SEND_SMS))[Manifest.permission.SEND_SMS] == true
    }

    private suspend fun ensureReadSmsPermission(): Boolean {
        if (hasReadSmsPermission()) return true
        val requester = permissionRequester ?: return false
        return requester.requestIfMissing(listOf(Manifest.permission.READ_SMS))[Manifest.permission.READ_SMS] == true
    }

    private suspend fun ensureReadContactsPermission(): Boolean {
        if (hasReadContactsPermission()) return true
        val requester = permissionRequester ?: return false
        return requester.requestIfMissing(listOf(Manifest.permission.READ_CONTACTS))[Manifest.permission.READ_CONTACTS] == true
    }

    // ── Result builders ─────────────────────────────────

    private fun okResult(to: String, message: String): SendResult =
        SendResult(ok = true, to = to, message = message, payloadJson = buildPayloadJson(json = json, ok = true, to = to, error = null))

    private fun errorResult(error: String, to: String = "", message: String? = null): SendResult =
        SendResult(ok = false, to = to, message = message, error = error, payloadJson = buildPayloadJson(json = json, ok = false, to = to, error = error))

    private fun searchError(error: String): SearchResult =
        SearchResult(ok = false, messages = emptyList(), error = error, payloadJson = buildQueryPayloadJson(json, ok = false, messages = emptyList(), error = error))

    // ── Contact lookup ──────────────────────────────────

    private fun getPhoneNumbersFromContactName(contactName: String): List<String> {
        val phoneNumbers = mutableListOf<String>()
        val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?"
        val selectionArgs = arrayOf("%$contactName%")

        context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            selection, selectionArgs, null,
        )?.use { cursor ->
            val numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
            while (cursor.moveToNext()) {
                val number = cursor.getString(numberIndex)
                if (!number.isNullOrBlank()) phoneNumbers.add(number.replace(Regex("""[\s\-()]"""), ""))
            }
        }
        return phoneNumbers
    }

    // ── SMS query ───────────────────────────────────────

    private fun querySmsMessages(params: QueryParams, phoneNumbers: List<String>): List<SmsMessage> {
        val messages = mutableListOf<SmsMessage>()
        val selections = mutableListOf<String>()
        val selectionArgs = mutableListOf<String>()

        // Time range
        params.startTime?.let { selections.add("${Telephony.Sms.DATE} >= ?"); selectionArgs.add(it.toString()) }
        params.endTime?.let { selections.add("${Telephony.Sms.DATE} <= ?"); selectionArgs.add(it.toString()) }

        // Phone numbers (from contact or direct)
        val allPhoneNumbers = if (!params.phoneNumber.isNullOrEmpty()) phoneNumbers + params.phoneNumber.replace(Regex("""[\s\-()]"""), "") else phoneNumbers
        if (allPhoneNumbers.isNotEmpty()) {
            val addressSelection = allPhoneNumbers.joinToString(" OR ") { "${Telephony.Sms.ADDRESS} LIKE ?" }
            selections.add("($addressSelection)")
            allPhoneNumbers.forEach { selectionArgs.add("%$it%") }
        }

        // Keyword
        if (!params.keyword.isNullOrEmpty()) { selections.add("${Telephony.Sms.BODY} LIKE ?"); selectionArgs.add("%${params.keyword}%") }
        // Type
        params.type?.let { selections.add("${Telephony.Sms.TYPE} = ?"); selectionArgs.add(it.toString()) }
        // Read status
        params.isRead?.let { selections.add("${Telephony.Sms.READ} = ?"); selectionArgs.add(if (it) "1" else "0") }

        val selection = selections.takeIf { it.isNotEmpty() }?.joinToString(" AND ")
        val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT ${params.limit} OFFSET ${params.offset}"

        context.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(Telephony.Sms._ID, Telephony.Sms.THREAD_ID, Telephony.Sms.ADDRESS, Telephony.Sms.PERSON, Telephony.Sms.DATE, Telephony.Sms.DATE_SENT, Telephony.Sms.READ, Telephony.Sms.TYPE, Telephony.Sms.BODY, Telephony.Sms.STATUS),
            selection, selectionArgs.toTypedArray().takeIf { it.isNotEmpty() }, sortOrder,
        )?.use { cursor ->
            val idIdx = cursor.getColumnIndex(Telephony.Sms._ID)
            val threadIdx = cursor.getColumnIndex(Telephony.Sms.THREAD_ID)
            val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
            val personIdx = cursor.getColumnIndex(Telephony.Sms.PERSON)
            val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
            val dateSentIdx = cursor.getColumnIndex(Telephony.Sms.DATE_SENT)
            val readIdx = cursor.getColumnIndex(Telephony.Sms.READ)
            val typeIdx = cursor.getColumnIndex(Telephony.Sms.TYPE)
            val bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY)
            val statusIdx = cursor.getColumnIndex(Telephony.Sms.STATUS)

            var count = 0
            while (cursor.moveToNext() && count < params.limit) {
                messages.add(SmsMessage(
                    id = cursor.getLong(idIdx), threadId = cursor.getLong(threadIdx),
                    address = cursor.getString(addrIdx), person = cursor.getString(personIdx),
                    date = cursor.getLong(dateIdx), dateSent = cursor.getLong(dateSentIdx),
                    read = cursor.getInt(readIdx) == 1, type = cursor.getInt(typeIdx),
                    body = cursor.getString(bodyIdx), status = cursor.getInt(statusIdx),
                ))
                count++
            }
        }
        return messages
    }
}
