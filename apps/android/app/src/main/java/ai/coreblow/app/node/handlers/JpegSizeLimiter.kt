package ai.coreblow.app.node.handlers

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

/**
 * Limits JPEG image size to a target maximum in kilobytes.
 *
 * Iteratively reduces JPEG quality until the output fits within
 * the specified byte budget, preserving aspect ratio.
 */
object JpegSizeLimiter {

    /**
     * Compress a JPEG byte array to fit within [maxSizeKb].
     *
     * @param input Raw JPEG bytes
     * @param maxSizeKb Maximum output size in kilobytes
     * @param startQuality Initial JPEG quality (1-100)
     * @param stepDown Quality reduction per iteration
     * @return Compressed JPEG bytes
     */
    fun limit(
        input: ByteArray,
        maxSizeKb: Int,
        startQuality: Int = 85,
        stepDown: Int = 10,
    ): ByteArray {
        if (input.size <= maxSizeKb * 1024) return input

        val bitmap = BitmapFactory.decodeByteArray(input, 0, input.size)
            ?: return input

        var quality = startQuality
        var result = input

        while (quality > 5) {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            result = stream.toByteArray()

            if (result.size <= maxSizeKb * 1024) break
            quality -= stepDown
        }

        return result
    }

    /**
     * Estimate the compression ratio needed to reach target size.
     */
    fun estimateQuality(currentSizeBytes: Int, targetSizeKb: Int): Int {
        if (currentSizeBytes <= 0) return 85
        val ratio = (targetSizeKb * 1024.0) / currentSizeBytes
        return (ratio * 100).toInt().coerceIn(5, 100)
    }
}
