package ai.coreblow.app.network

import android.util.Log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

// ============================================================
// APIClient — HTTP client for gateway REST endpoints
// ============================================================

class APIClient(private val client: OkHttpClient) {

    companion object {
        private const val TAG = "APIClient"
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }

    suspend fun get(url: String, headers: Map<String, String> = emptyMap()): ApiResponse {
        val request = Request.Builder().url(url).apply {
            headers.forEach { (k, v) -> addHeader(k, v) }
        }.build()
        return execute(request)
    }

    suspend fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): ApiResponse {
        val request = Request.Builder().url(url)
            .post(body.toRequestBody(JSON_MEDIA))
            .apply { headers.forEach { (k, v) -> addHeader(k, v) } }
            .build()
        return execute(request)
    }

    suspend fun delete(url: String, headers: Map<String, String> = emptyMap()): ApiResponse {
        val request = Request.Builder().url(url).delete()
            .apply { headers.forEach { (k, v) -> addHeader(k, v) } }
            .build()
        return execute(request)
    }

    private fun execute(request: Request): ApiResponse {
        return try {
            val response = client.newCall(request).execute()
            ApiResponse(
                statusCode = response.code,
                body = response.body?.string(),
                headers = response.headers.toMap(),
                isSuccessful = response.isSuccessful,
            )
        } catch (e: IOException) {
            Log.e(TAG, "Request failed: ${e.message}")
            ApiResponse(statusCode = -1, body = null, isSuccessful = false, error = e.message)
        }
    }
}

data class ApiResponse(
    val statusCode: Int,
    val body: String?,
    val headers: Map<String, List<String>> = emptyMap(),
    val isSuccessful: Boolean,
    val error: String? = null,
)

// ============================================================
// AuthInterceptor — adds auth token to requests
// ============================================================

class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenProvider()
        return if (token != null) {
            chain.proceed(request.newBuilder().addHeader("Authorization", "Bearer $token").build())
        } else {
            chain.proceed(request)
        }
    }
}

// ============================================================
// RetryInterceptor — retry failed requests
// ============================================================

class RetryInterceptor(private val maxRetries: Int = 3, private val retryDelayMs: Long = 1000) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var lastException: IOException? = null
        for (attempt in 0..maxRetries) {
            try {
                val response = chain.proceed(chain.request())
                if (response.isSuccessful || response.code < 500) return response
                if (attempt < maxRetries) {
                    response.close()
                    Thread.sleep(retryDelayMs * (attempt + 1))
                } else {
                    return response
                }
            } catch (e: IOException) {
                lastException = e
                if (attempt < maxRetries) Thread.sleep(retryDelayMs * (attempt + 1))
            }
        }
        throw lastException ?: IOException("Max retries exceeded")
    }
}

// ============================================================
// StreamReader — reads SSE/streaming responses
// ============================================================

class StreamReader {
    companion object {
        private const val TAG = "StreamReader"
    }

    fun readStream(response: Response, onChunk: (String) -> Unit, onDone: () -> Unit, onError: (String) -> Unit) {
        val body = response.body ?: run { onError("No response body"); return }
        try {
            val reader = BufferedReader(InputStreamReader(body.byteStream()))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                val data = line ?: continue
                if (data.startsWith("data: ")) {
                    val payload = data.removePrefix("data: ").trim()
                    if (payload == "[DONE]") {
                        onDone()
                        return
                    }
                    onChunk(payload)
                }
            }
            onDone()
        } catch (e: Exception) {
            Log.e(TAG, "Stream error: ${e.message}")
            onError(e.message ?: "Stream read error")
        } finally {
            body.close()
        }
    }
}

private fun Headers.toMap(): Map<String, List<String>> {
    val map = mutableMapOf<String, List<String>>()
    for (name in names()) {
        map[name] = values(name)
    }
    return map
}
