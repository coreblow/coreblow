package ai.coreblow.app.node.handlers

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log

/**
 * Limits JPEG image size for gateway transmission.
 * Iteratively reduces quality until the encoded size
 * falls below the max threshold, preserving aspect ratio.
 */
object JpegSizeLimiter {

    private const val TAG = "JpegSizeLimiter"
    private const val DEFAULT_MAX_BYTES = 500_000 // 500KB
    private const val MIN_QUALITY = 10
    private const val QUALITY_STEP = 10
    private const val MAX_ITERATIONS = 15

    /**
     * Limit a base64 JPEG string to maxBytes.
     * Returns null if already within limits.
     */
    fun limit(
        base64: String,
        maxBytes: Int = DEFAULT_MAX_BYTES,
        minQuality: Int = MIN_QUALITY,
    ): LimitResult? {
        val rawBytes = Base64.decode(base64, Base64.DEFAULT)
        if (rawBytes.size <= maxBytes) return null // Already OK

        val bitmap = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size)
            ?: return null

        var quality = 85
        var result: ByteArray = rawBytes
        var iterations = 0

        while (result.size > maxBytes && quality >= minQuality && iterations < MAX_ITERATIONS) {
            val stream = java.io.ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            result = stream.toByteArray()
            quality -= QUALITY_STEP
            iterations++
        }

        // If still too large, try scaling down
        if (result.size > maxBytes) {
            val scaleFactor = Math.sqrt(maxBytes.toDouble() / result.size).coerceIn(0.25, 0.95)
            val scaledWidth = (bitmap.width * scaleFactor).toInt().coerceAtLeast(100)
            val scaledHeight = (bitmap.height * scaleFactor).toInt().coerceAtLeast(100)

            val scaledBitmap = Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true)
            val stream = java.io.ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, (quality + QUALITY_STEP).coerceAtLeast(minQuality), stream)
            result = stream.toByteArray()
            scaledBitmap.recycle()
        }

        bitmap.recycle()

        val encoded = Base64.encodeToString(result, Base64.NO_WRAP)
        Log.d(TAG, "Compressed: ${rawBytes.size} → ${result.size} bytes (q=${quality + QUALITY_STEP}, iter=$iterations)")

        return LimitResult(
            base64 = encoded,
            quality = (quality + QUALITY_STEP).coerceAtLeast(minQuality),
            sizeBytes = result.size,
            originalSizeBytes = rawBytes.size,
            iterations = iterations,
            wasScaled = result.size != rawBytes.size,
        )
    }

    /**
     * Limit a raw byte array and return compressed bytes.
     */
    fun limitBytes(
        jpegBytes: ByteArray,
        maxBytes: Int = DEFAULT_MAX_BYTES,
        minQuality: Int = MIN_QUALITY,
    ): ByteArray {
        if (jpegBytes.size <= maxBytes) return jpegBytes

        val bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
            ?: return jpegBytes

        var quality = 85
        var result: ByteArray = jpegBytes

        while (result.size > maxBytes && quality >= minQuality) {
            val stream = java.io.ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            result = stream.toByteArray()
            quality -= QUALITY_STEP
        }

        bitmap.recycle()
        return result
    }

    /**
     * Estimate output size for a given quality.
     */
    fun estimateSize(width: Int, height: Int, quality: Int = 80): Int {
        val pixels = width * height
        val bitsPerPixel = when {
            quality >= 90 -> 3.0
            quality >= 70 -> 1.5
            quality >= 50 -> 0.8
            else -> 0.4
        }
        return (pixels * bitsPerPixel / 8).toInt()
    }

    /**
     * Calculate optimal quality for a target size.
     */
    fun optimalQuality(width: Int, height: Int, targetBytes: Int): Int {
        val pixels = width * height
        val targetBpp = targetBytes.toDouble() * 8 / pixels
        return when {
            targetBpp >= 3.0 -> 95
            targetBpp >= 1.5 -> 85
            targetBpp >= 0.8 -> 70
            targetBpp >= 0.4 -> 50
            targetBpp >= 0.2 -> 30
            else -> MIN_QUALITY
        }
    }

    data class LimitResult(
        val base64: String,
        val quality: Int,
        val sizeBytes: Int,
        val originalSizeBytes: Int,
        val iterations: Int,
        val wasScaled: Boolean,
    ) {
        val compressionRatio: Double get() = if (originalSizeBytes > 0) sizeBytes.toDouble() / originalSizeBytes else 1.0
        val savedBytes: Int get() = originalSizeBytes - sizeBytes
        val savedPercent: Int get() = if (originalSizeBytes > 0) ((savedBytes.toDouble() / originalSizeBytes) * 100).toInt() else 0
    }
}
