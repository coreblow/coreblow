package ai.coreblow.app.node.handlers

import android.content.Context
import android.util.Log
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Debug handler for gateway diagnostic commands.
 * Provides runtime inspection, log capture, and
 * test invoke responses.
 */
class DebugHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "DebugHandler"
        private const val MAX_LOG_LINES = 100
    }

    private val logBuffer = ArrayDeque<String>(MAX_LOG_LINES)

    /**
     * Echo back the input for connectivity testing.
     */
    fun echo(input: String): String = buildJsonObject {
        put("echo", JsonPrimitive(input))
        put("timestampMs", JsonPrimitive(System.currentTimeMillis()))
    }.toString()

    /**
     * Get runtime diagnostics.
     */
    fun getDiagnostics(): String {
        val rt = Runtime.getRuntime()
        return buildJsonObject {
            put("heapUsedMb", JsonPrimitive((rt.totalMemory() - rt.freeMemory()) / (1024 * 1024)))
            put("heapMaxMb", JsonPrimitive(rt.maxMemory() / (1024 * 1024)))
            put("threadCount", JsonPrimitive(Thread.activeCount()))
            put("uptimeMs", JsonPrimitive(android.os.SystemClock.elapsedRealtime()))
            put("logBufferSize", JsonPrimitive(logBuffer.size))
            put("packageName", JsonPrimitive(appContext.packageName))
        }.toString()
    }

    /**
     * Append a log line to the debug buffer.
     */
    fun appendLog(line: String) {
        if (logBuffer.size >= MAX_LOG_LINES) logBuffer.removeFirst()
        logBuffer.addLast("[${System.currentTimeMillis()}] $line")
    }

    /**
     * Get recent log lines.
     */
    fun getRecentLogs(count: Int = 20): String {
        return logBuffer.takeLast(count.coerceIn(1, MAX_LOG_LINES)).joinToString("\n")
    }

    /**
     * Clear the log buffer.
     */
    fun clearLogs() {
        logBuffer.clear()
    }

    /**
     * Trigger a test crash for crash reporting verification.
     */
    fun testCrash() {
        Log.w(TAG, "Test crash triggered")
        throw RuntimeException("Debug test crash — this is intentional")
    }
}
