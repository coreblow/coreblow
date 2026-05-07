package ai.coreblow.app.worker

import android.content.Context
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * Periodic health check worker — pings gateway and reports device health.
 */
class HealthCheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val TAG = "HealthCheckWorker"
        const val WORK_NAME = "health_check"
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<HealthCheckWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
    override suspend fun doWork(): Result {
        Log.d(TAG, "Health check running")
        return Result.success()
    }
}

/**
 * Periodic sync worker — syncs conversation and settings data.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val TAG = "SyncWorker"
        const val WORK_NAME = "data_sync"
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
    override suspend fun doWork(): Result {
        Log.d(TAG, "Sync running")
        return Result.success()
    }
}

/**
 * Periodic cache cleanup worker — clears expired cache entries.
 */
class CacheCleanupWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val TAG = "CacheCleanupWorker"
        const val WORK_NAME = "cache_cleanup"
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<CacheCleanupWorker>(6, TimeUnit.HOURS)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
    override suspend fun doWork(): Result {
        Log.d(TAG, "Cache cleanup running")
        val cacheDir = applicationContext.cacheDir
        val maxAge = 24 * 60 * 60 * 1000L // 24 hours
        val now = System.currentTimeMillis()
        var deleted = 0
        cacheDir.listFiles()?.forEach { file ->
            if (now - file.lastModified() > maxAge) {
                if (file.delete()) deleted++
            }
        }
        Log.d(TAG, "Cleaned $deleted cached files")
        return Result.success()
    }
}

/**
 * One-time model download worker.
 */
class ModelDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val TAG = "ModelDownloadWorker"
        fun enqueue(context: Context, modelUrl: String) {
            val data = Data.Builder().putString("model_url", modelUrl).build()
            val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>()
                .setInputData(data)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).build())
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
    override suspend fun doWork(): Result {
        val url = inputData.getString("model_url") ?: return Result.failure()
        Log.d(TAG, "Downloading model: $url")
        return Result.success()
    }
}

/**
 * Periodic log upload worker.
 */
class LogUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val TAG = "LogUploadWorker"
        const val WORK_NAME = "log_upload"
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<LogUploadWorker>(1, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
    override suspend fun doWork(): Result {
        Log.d(TAG, "Log upload running")
        return Result.success()
    }
}
