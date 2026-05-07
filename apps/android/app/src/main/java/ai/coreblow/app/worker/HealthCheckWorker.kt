package ai.coreblow.app.worker

import android.content.Context
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Periodic background health check worker.
 * Monitors gateway connectivity, reports device health metrics,
 * and sends heartbeat pings. Runs via WorkManager on a 15-min schedule.
 */
class HealthCheckWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HealthCheckWorker"
        const val WORK_NAME = "coreblow_health_check"
        private const val HEALTH_TIMEOUT_MS = 10_000L
        private const val KEY_GATEWAY_HOST = "gateway_host"
        private const val KEY_GATEWAY_PORT = "gateway_port"
        private const val KEY_USE_TLS = "use_tls"
        private const val KEY_LAST_STATUS = "last_status"

        /**
         * Schedule periodic health checks.
         */
        fun schedule(context: Context, host: String, port: Int = 18789, useTls: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val inputData = Data.Builder()
                .putString(KEY_GATEWAY_HOST, host)
                .putInt(KEY_GATEWAY_PORT, port)
                .putBoolean(KEY_USE_TLS, useTls)
                .build()

            val request = PeriodicWorkRequestBuilder<HealthCheckWorker>(
                15, TimeUnit.MINUTES,
                5, TimeUnit.MINUTES, // flex interval
            )
                .setConstraints(constraints)
                .setInputData(inputData)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .addTag("health_check")
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
            Log.i(TAG, "Health check scheduled for $host:$port (tls=$useTls)")
        }

        /**
         * Run a one-time immediate health check.
         */
        fun runOnce(context: Context, host: String, port: Int = 18789, useTls: Boolean = false) {
            val inputData = Data.Builder()
                .putString(KEY_GATEWAY_HOST, host)
                .putInt(KEY_GATEWAY_PORT, port)
                .putBoolean(KEY_USE_TLS, useTls)
                .build()

            val request = OneTimeWorkRequestBuilder<HealthCheckWorker>()
                .setInputData(inputData)
                .addTag("health_check_once")
                .build()

            WorkManager.getInstance(context).enqueue(request)
        }

        /**
         * Cancel all health checks.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.i(TAG, "Health checks cancelled")
        }

        /**
         * Get last health check status from SharedPreferences.
         */
        fun getLastStatus(context: Context): HealthStatus? {
            val prefs = context.getSharedPreferences("coreblow_health", Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_LAST_STATUS, null) ?: return null
            return try {
                val obj = Json.parseToJsonElement(json).jsonObject
                HealthStatus(
                    isHealthy = obj["isHealthy"]?.jsonPrimitive?.booleanOrNull ?: false,
                    latencyMs = obj["latencyMs"]?.jsonPrimitive?.intOrNull ?: -1,
                    gatewayVersion = obj["gatewayVersion"]?.jsonPrimitive?.contentOrNull,
                    timestampMs = obj["timestampMs"]?.jsonPrimitive?.longOrNull ?: 0,
                    errorMessage = obj["errorMessage"]?.jsonPrimitive?.contentOrNull,
                )
            } catch (_: Exception) { null }
        }
    }

    override suspend fun doWork(): Result {
        val host = inputData.getString(KEY_GATEWAY_HOST) ?: return Result.failure()
        val port = inputData.getInt(KEY_GATEWAY_PORT, 18789)
        val useTls = inputData.getBoolean(KEY_USE_TLS, false)

        Log.d(TAG, "Running health check: $host:$port")

        val status = checkHealth(host, port, useTls)
        saveStatus(status)

        return if (status.isHealthy) {
            Log.i(TAG, "Health OK (latency=${status.latencyMs}ms, version=${status.gatewayVersion})")
            val outputData = Data.Builder()
                .putBoolean("healthy", true)
                .putInt("latency_ms", status.latencyMs)
                .putString("version", status.gatewayVersion ?: "")
                .build()
            Result.success(outputData)
        } else {
            Log.w(TAG, "Health FAIL: ${status.errorMessage}")
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private suspend fun checkHealth(host: String, port: Int, useTls: Boolean): HealthStatus {
        val scheme = if (useTls) "https" else "http"
        val url = "$scheme://$host:$port/health"
        val startMs = System.currentTimeMillis()

        return withContext(Dispatchers.IO) {
            try {
                val result = withTimeoutOrNull(HEALTH_TIMEOUT_MS) {
                    val connection = URL(url).openConnection() as HttpURLConnection
                    connection.connectTimeout = 5000
                    connection.readTimeout = 5000
                    connection.requestMethod = "GET"
                    connection.setRequestProperty("User-Agent", "CoreBlow-Android/1.0")

                    try {
                        val responseCode = connection.responseCode
                        val latencyMs = (System.currentTimeMillis() - startMs).toInt()

                        if (responseCode == 200) {
                            val body = connection.inputStream.bufferedReader().readText()
                            val json = try { Json.parseToJsonElement(body).jsonObject } catch (_: Exception) { null }
                            HealthStatus(
                                isHealthy = true,
                                latencyMs = latencyMs,
                                gatewayVersion = json?.get("version")?.jsonPrimitive?.contentOrNull,
                                timestampMs = System.currentTimeMillis(),
                            )
                        } else {
                            HealthStatus(
                                isHealthy = false,
                                latencyMs = latencyMs,
                                timestampMs = System.currentTimeMillis(),
                                errorMessage = "HTTP $responseCode",
                            )
                        }
                    } finally {
                        connection.disconnect()
                    }
                }

                result ?: HealthStatus(
                    isHealthy = false,
                    timestampMs = System.currentTimeMillis(),
                    errorMessage = "Health check timeout (${HEALTH_TIMEOUT_MS}ms)",
                )
            } catch (e: Exception) {
                HealthStatus(
                    isHealthy = false,
                    timestampMs = System.currentTimeMillis(),
                    errorMessage = "Connection error: ${e.message}",
                )
            }
        }
    }

    private fun saveStatus(status: HealthStatus) {
        val json = buildJsonObject {
            put("isHealthy", status.isHealthy)
            put("latencyMs", status.latencyMs)
            status.gatewayVersion?.let { put("gatewayVersion", it) }
            put("timestampMs", status.timestampMs)
            status.errorMessage?.let { put("errorMessage", it) }
        }.toString()

        applicationContext.getSharedPreferences("coreblow_health", Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_STATUS, json).apply()
    }
}

data class HealthStatus(
    val isHealthy: Boolean,
    val latencyMs: Int = -1,
    val gatewayVersion: String? = null,
    val timestampMs: Long = System.currentTimeMillis(),
    val errorMessage: String? = null,
) {
    val ageMs: Long get() = System.currentTimeMillis() - timestampMs
    val isStale: Boolean get() = ageMs > 20 * 60 * 1000 // >20 minutes
}
