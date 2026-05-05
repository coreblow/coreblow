package ai.coreblow.app.node.handlers

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream

/**
 * Manages camera capture lifecycle for the CameraHandler.
 *
 * Wraps CameraX APIs to provide photo capture with configurable
 * quality, resolution, and JPEG compression.
 */
class CameraCaptureManager(private val context: Context) {

    companion object {
        private const val TAG = "CameraCaptureManager"
        private const val DEFAULT_QUALITY = 80
        private const val MAX_DIMENSION = 1920
    }

    /**
     * Capture a photo and return as Base64-encoded JPEG.
     * In production, this integrates with CameraX ImageCapture use case.
     */
    suspend fun capturePhoto(quality: Int = DEFAULT_QUALITY): CaptureResult {
        Log.i(TAG, "Photo capture requested (quality=$quality)")
        // CameraX integration point
        return CaptureResult(status = CaptureStatus.PENDING, data = null, mimeType = "image/jpeg")
    }

    /**
     * Compress a bitmap to JPEG with size constraints.
     */
    fun compressToJpeg(bitmap: Bitmap, quality: Int, maxSizeKb: Int): ByteArray {
        val scaled = scaleDown(bitmap, MAX_DIMENSION)
        var currentQuality = quality

        while (currentQuality > 10) {
            val stream = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, currentQuality, stream)
            val bytes = stream.toByteArray()

            if (bytes.size <= maxSizeKb * 1024 || currentQuality <= 10) {
                return bytes
            }
            currentQuality -= 10
        }

        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 10, stream)
        return stream.toByteArray()
    }

    /**
     * Encode raw bytes to Base64 string.
     */
    fun encodeBase64(data: ByteArray): String {
        return Base64.encodeToString(data, Base64.NO_WRAP)
    }

    private fun scaleDown(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height

        if (width <= maxDimension && height <= maxDimension) return bitmap

        val ratio = maxDimension.toFloat() / maxOf(width, height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()

        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }
}

enum class CaptureStatus { SUCCESS, PENDING, ERROR }

data class CaptureResult(
    val status: CaptureStatus,
    val data: String?,
    val mimeType: String,
)
