package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import kotlinx.serialization.json.*

/**
 * Debug handler for gateway diagnostic commands.
 * Provides runtime inspection, log capture, test invoke responses,
 * configuration dump, and performance profiling.
 */
class DebugHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "DebugHandler"
        private const val MAX_LOG_LINES = 200
    }

    private val logBuffer = ArrayDeque<LogEntry>(MAX_LOG_LINES)
    private val timers = mutableMapOf<String, Long>()
    private val counters = mutableMapOf<String, Long>()
    private var echoCount = 0L

    /**
     * Echo back the input for connectivity testing.
     */
    fun echo(input: String): String {
        echoCount++
        return buildJsonObject {
            put("echo", input)
            put("timestampMs", System.currentTimeMillis())
            put("echoCount", echoCount)
        }.toString()
    }

    /**
     * Get runtime diagnostics.
     */
    fun getDiagnostics(): String {
        val rt = Runtime.getRuntime()
        return buildJsonObject {
            put("heapUsedMb", (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024))
            put("heapMaxMb", rt.maxMemory() / (1024 * 1024))
            put("heapFreeMb", rt.freeMemory() / (1024 * 1024))
            put("threadCount", Thread.activeCount())
            put("uptimeMs", android.os.SystemClock.elapsedRealtime())
            put("logBufferSize", logBuffer.size)
            put("packageName", appContext.packageName)
            put("echoCount", echoCount)
            put("activeTimers", timers.size)
            put("counters", buildJsonObject { counters.forEach { (k, v) -> put(k, v) } })
        }.toString()
    }

    /**
     * Append a log line to the debug buffer.
     */
    fun appendLog(level: String, message: String, source: String? = null) {
        if (logBuffer.size >= MAX_LOG_LINES) logBuffer.removeFirst()
        logBuffer.addLast(LogEntry(
            timestampMs = System.currentTimeMillis(),
            level = level,
            message = message,
            source = source ?: TAG,
        ))
    }

    fun logInfo(message: String, source: String? = null) = appendLog("INFO", message, source)
    fun logWarn(message: String, source: String? = null) = appendLog("WARN", message, source)
    fun logError(message: String, source: String? = null) = appendLog("ERROR", message, source)
    fun logDebug(message: String, source: String? = null) = appendLog("DEBUG", message, source)

    /**
     * Get recent log lines as JSON.
     */
    fun getRecentLogs(count: Int = 30, level: String? = null): String {
        val filtered = if (level != null) {
            logBuffer.filter { it.level.equals(level, ignoreCase = true) }
        } else logBuffer.toList()

        val limited = filtered.takeLast(count.coerceIn(1, MAX_LOG_LINES))

        return buildJsonObject {
            put("logs", buildJsonArray {
                limited.forEach { entry ->
                    add(buildJsonObject {
                        put("ts", entry.timestampMs)
                        put("level", entry.level)
                        put("msg", entry.message)
                        put("src", entry.source)
                    })
                }
            })
            put("total", logBuffer.size)
            put("returned", limited.size)
        }.toString()
    }

    /**
     * Get logs as plain text.
     */
    fun getLogsAsText(count: Int = 30): String {
        return logBuffer.takeLast(count).joinToString("\n") { entry ->
            "[${entry.level}] ${entry.timestampMs} [${entry.source}] ${entry.message}"
        }
    }

    /**
     * Clear the log buffer.
     */
    fun clearLogs(): String {
        val cleared = logBuffer.size
        logBuffer.clear()
        return buildJsonObject { put("cleared", cleared) }.toString()
    }

    /**
     * Start a named timer for performance profiling.
     */
    fun startTimer(name: String) {
        timers[name] = System.nanoTime()
    }

    /**
     * Stop a named timer and return elapsed time.
     */
    fun stopTimer(name: String): String {
        val start = timers.remove(name)
        val elapsedNs = if (start != null) System.nanoTime() - start else -1
        val elapsedMs = if (elapsedNs > 0) elapsedNs / 1_000_000.0 else -1.0

        return buildJsonObject {
            put("timer", name)
            put("elapsedMs", elapsedMs)
            put("elapsedNs", elapsedNs)
        }.toString()
    }

    /**
     * Increment a named counter.
     */
    fun incrementCounter(name: String, amount: Long = 1): Long {
        val newVal = (counters[name] ?: 0) + amount
        counters[name] = newVal
        return newVal
    }

    /**
     * Get all counter values.
     */
    fun getCounters(): String {
        return buildJsonObject {
            counters.forEach { (k, v) -> put(k, v) }
        }.toString()
    }

    /**
     * Reset all counters.
     */
    fun resetCounters() {
        counters.clear()
    }

    /**
     * Dump current configuration.
     */
    fun dumpConfig(): String {
        val prefs = appContext.getSharedPreferences("coreblow_settings", Context.MODE_PRIVATE)
        return buildJsonObject {
            put("settings", buildJsonObject {
                prefs.all.forEach { (k, v) ->
                    when (v) {
                        is String -> put(k, v)
                        is Int -> put(k, v)
                        is Long -> put(k, v)
                        is Float -> put(k, v.toDouble())
                        is Boolean -> put(k, v)
                        else -> put(k, v.toString())
                    }
                }
            })
            put("diagnostics", buildJsonObject {
                put("logBufferSize", logBuffer.size)
                put("echoCount", echoCount)
                put("activeTimers", timers.keys.toList().let { JsonArray(it.map { k -> JsonPrimitive(k) }) })
                put("counterCount", counters.size)
            })
        }.toString()
    }

    /**
     * Trigger a test crash for crash reporting verification.
     */
    fun testCrash() {
        Log.w(TAG, "Test crash triggered")
        throw RuntimeException("Debug test crash — this is intentional")
    }
}

private data class LogEntry(
    val timestampMs: Long,
    val level: String,
    val message: String,
    val source: String,
)
