package ai.coreblow.app.node.handlers

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream

/**
 * JPEG size limiter — iteratively compresses a JPEG image
 * until it fits within the specified maximum byte size.
 * Used by CameraHandler and PhotosHandler to meet gateway
 * upload size constraints.
 */
object JpegSizeLimiter {

    /**
     * Compress a base64-encoded JPEG to fit within maxBytes.
     *
     * @param base64 The original base64-encoded JPEG image.
     * @param maxBytes The maximum allowed size in bytes.
     * @param minQuality The minimum JPEG quality to attempt (default: 10).
     * @param qualityStep How much to reduce quality per iteration (default: 10).
     * @return A pair of (limitedBase64, finalQuality), or null if impossible.
     */
    fun limit(
        base64: String,
        maxBytes: Int,
        minQuality: Int = 10,
        qualityStep: Int = 10,
    ): LimitResult? {
        val originalBytes = Base64.decode(base64, Base64.NO_WRAP)

        // Already within limit
        if (originalBytes.size <= maxBytes) {
            return LimitResult(base64, 100, originalBytes.size, false)
        }

        val bitmap = BitmapFactory.decodeByteArray(originalBytes, 0, originalBytes.size)
            ?: return null

        var quality = 90

        while (quality >= minQuality) {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            val compressed = stream.toByteArray()

            if (compressed.size <= maxBytes) {
                val result = Base64.encodeToString(compressed, Base64.NO_WRAP)
                bitmap.recycle()
                return LimitResult(result, quality, compressed.size, true)
            }

            quality -= qualityStep
        }

        // Last resort — scale down
        val scale = maxBytes.toFloat() / originalBytes.size * 0.8f
        val scaledWidth = (bitmap.width * scale).toInt().coerceAtLeast(100)
        val scaledHeight = (bitmap.height * scale).toInt().coerceAtLeast(100)
        val scaled = Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true)

        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, minQuality, stream)
        val compressed = stream.toByteArray()
        val result = Base64.encodeToString(compressed, Base64.NO_WRAP)

        bitmap.recycle()
        scaled.recycle()

        return if (compressed.size <= maxBytes) {
            LimitResult(result, minQuality, compressed.size, true)
        } else null
    }

    /**
     * Estimate the quality needed to reach a target byte size.
     */
    fun estimateQuality(currentBytes: Int, targetBytes: Int, currentQuality: Int = 100): Int {
        if (currentBytes <= targetBytes) return currentQuality
        val ratio = targetBytes.toFloat() / currentBytes
        return (currentQuality * ratio * 0.9f).toInt().coerceIn(10, 100)
    }
}

/**
 * Result of JPEG size limiting.
 */
data class LimitResult(
    val base64: String,
    val quality: Int,
    val sizeBytes: Int,
    val wasCompressed: Boolean,
)
