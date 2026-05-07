package ai.coreblow.app.node.handlers

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import ai.coreblow.app.gateway.GatewaySession
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Handler for call-log queries via the gateway `callLog.search` command.
 *
 * Uses [CallLogDataSource] for testability — production code uses the
 * system [ContentResolver], while tests can inject a fake.
 */
class CallLogHandler private constructor(
    private val appContext: Context,
    private val dataSource: CallLogDataSource,
) {

    constructor(appContext: Context) : this(
        appContext = appContext,
        dataSource = SystemCallLogDataSource,
    )

    companion object {
        private const val TAG = "CallLogHandler"
        private const val DEFAULT_LIMIT = 25

        /** Create an instance with a custom data source for tests. */
        fun forTesting(
            appContext: Context,
            dataSource: CallLogDataSource,
        ): CallLogHandler = CallLogHandler(appContext = appContext, dataSource = dataSource)
    }

    fun handleCallLogSearch(paramsJson: String?): GatewaySession.InvokeResult {
        if (!dataSource.hasReadPermission(appContext)) {
            return GatewaySession.InvokeResult.error(
                code = "CALL_LOG_PERMISSION_REQUIRED",
                message = "CALL_LOG_PERMISSION_REQUIRED: grant Call Log permission",
            )
        }

        val request = parseSearchRequest(paramsJson)
            ?: return GatewaySession.InvokeResult.error(
                code = "INVALID_REQUEST",
                message = "INVALID_REQUEST: expected JSON object",
            )

        return try {
            val records = dataSource.search(appContext, request)
            Log.d(TAG, "callLog.search returned ${records.size} records")
            GatewaySession.InvokeResult.ok(
                buildJsonObject {
                    put("callLogs", buildJsonArray {
                        records.forEach { add(recordToJson(it)) }
                    })
                }.toString(),
            )
        } catch (err: Throwable) {
            Log.e(TAG, "callLog.search failed", err)
            GatewaySession.InvokeResult.error(
                code = "CALL_LOG_UNAVAILABLE",
                message = "CALL_LOG_UNAVAILABLE: ${err.message ?: "call log query failed"}",
            )
        }
    }

    // ── Request parsing ─────────────────────────────────────

    private fun parseSearchRequest(paramsJson: String?): CallLogSearchRequest? {
        if (paramsJson.isNullOrBlank()) {
            return CallLogSearchRequest(
                limit = DEFAULT_LIMIT, offset = 0,
                cachedName = null, number = null,
                date = null, dateStart = null, dateEnd = null,
                duration = null, type = null,
            )
        }

        val params = try {
            Json.parseToJsonElement(paramsJson) as? JsonObject
        } catch (_: Throwable) {
            null
        } ?: return null

        return CallLogSearchRequest(
            limit = params.intOrNull("limit")?.coerceIn(1, 200) ?: DEFAULT_LIMIT,
            offset = params.intOrNull("offset")?.coerceAtLeast(0) ?: 0,
            cachedName = params.stringOrNull("cachedName"),
            number = params.stringOrNull("number"),
            date = params.longOrNull("date"),
            dateStart = params.longOrNull("dateStart"),
            dateEnd = params.longOrNull("dateEnd"),
            duration = params.longOrNull("duration"),
            type = params.intOrNull("type"),
        )
    }

    private fun recordToJson(record: CallLogRecord): JsonObject = buildJsonObject {
        put("number", JsonPrimitive(record.number))
        put("cachedName", JsonPrimitive(record.cachedName))
        put("date", JsonPrimitive(record.date))
        put("duration", JsonPrimitive(record.duration))
        put("type", JsonPrimitive(record.type))
    }

    // ── JSON helpers ────────────────────────────────────────

    private fun JsonObject.stringOrNull(key: String): String? =
        (get(key) as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() }

    private fun JsonObject.intOrNull(key: String): Int? =
        (get(key) as? JsonPrimitive)?.content?.toIntOrNull()

    private fun JsonObject.longOrNull(key: String): Long? =
        (get(key) as? JsonPrimitive)?.content?.toLongOrNull()
}

// ── Data models ─────────────────────────────────────────

data class CallLogRecord(
    val number: String?,
    val cachedName: String?,
    val date: Long,
    val duration: Long,
    val type: Int,
)

data class CallLogSearchRequest(
    val limit: Int,
    val offset: Int,
    val cachedName: String?,
    val number: String?,
    val date: Long?,
    val dateStart: Long?,
    val dateEnd: Long?,
    val duration: Long?,
    val type: Int?,
)

// ── Data source interface + system implementation ───────

interface CallLogDataSource {
    fun hasReadPermission(context: Context): Boolean
    fun search(context: Context, request: CallLogSearchRequest): List<CallLogRecord>
}

private object SystemCallLogDataSource : CallLogDataSource {
    override fun hasReadPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_CALL_LOG,
        ) == PackageManager.PERMISSION_GRANTED

    override fun search(context: Context, request: CallLogSearchRequest): List<CallLogRecord> {
        val projection = arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.TYPE,
        )

        val selections = mutableListOf<String>()
        val args = mutableListOf<String>()

        request.cachedName?.let {
            selections += "${CallLog.Calls.CACHED_NAME} LIKE ?"
            args += "%$it%"
        }
        request.number?.let {
            selections += "${CallLog.Calls.NUMBER} LIKE ?"
            args += "%$it%"
        }

        // Time range
        if (request.dateStart != null && request.dateEnd != null) {
            selections += "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DATE} <= ?"
            args += request.dateStart.toString()
            args += request.dateEnd.toString()
        } else if (request.dateStart != null) {
            selections += "${CallLog.Calls.DATE} >= ?"
            args += request.dateStart.toString()
        } else if (request.dateEnd != null) {
            selections += "${CallLog.Calls.DATE} <= ?"
            args += request.dateEnd.toString()
        } else if (request.date != null) {
            selections += "${CallLog.Calls.DATE} = ?"
            args += request.date.toString()
        }

        request.duration?.let {
            selections += "${CallLog.Calls.DURATION} = ?"
            args += it.toString()
        }
        request.type?.let {
            selections += "${CallLog.Calls.TYPE} = ?"
            args += it.toString()
        }

        val selection = selections.takeIf { it.isNotEmpty() }?.joinToString(" AND ")
        val selArgs = args.takeIf { it.isNotEmpty() }?.toTypedArray()

        context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            selection,
            selArgs,
            "${CallLog.Calls.DATE} DESC",
        ).use { cursor ->
            if (cursor == null) return emptyList()

            val iNumber = cursor.getColumnIndex(CallLog.Calls.NUMBER)
            val iName = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
            val iDate = cursor.getColumnIndex(CallLog.Calls.DATE)
            val iDuration = cursor.getColumnIndex(CallLog.Calls.DURATION)
            val iType = cursor.getColumnIndex(CallLog.Calls.TYPE)

            if (request.offset > 0) cursor.moveToPosition(request.offset - 1)

            val out = mutableListOf<CallLogRecord>()
            var count = 0
            while (cursor.moveToNext() && count < request.limit) {
                out += CallLogRecord(
                    number = cursor.getString(iNumber),
                    cachedName = cursor.getString(iName),
                    date = cursor.getLong(iDate),
                    duration = cursor.getLong(iDuration),
                    type = cursor.getInt(iType),
                )
                count++
            }
            return out
        }
    }
}
