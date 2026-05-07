package ai.coreblow.app.node.handlers

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import ai.coreblow.app.node.CameraCaptureManager
import ai.coreblow.app.node.CameraHudKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.io.ByteArrayOutputStream
import kotlin.coroutines.resume

/**
 * Handles camera capture operations for gateway invoke commands.
 * Supports front/back camera selection, quality control, flash triggering,
 * and HUD status display.
 */
class CameraHandler(
    private val appContext: Context,
    private val camera: CameraCaptureManager,
    private val externalAudioCaptureActive: StateFlow<Boolean>,
    private val showCameraHud: (message: String, kind: CameraHudKind, autoHideMs: Long?) -> Unit,
    private val triggerCameraFlash: () -> Unit,
    private val invokeErrorFromThrowable: (Throwable) -> String,
) {
    companion object {
        private const val TAG = "CameraHandler"
        private const val CAPTURE_TIMEOUT_MS = 15_000L
        private const val DEFAULT_QUALITY = 80
        private const val MAX_DIMENSION = 1920
        private const val THUMBNAIL_SIZE = 320
    }

    /**
     * Capture a photo and return base64-encoded JPEG.
     */
    suspend fun capturePhoto(
        facing: String? = null,
        quality: Int? = null,
        flash: Boolean = true,
        showHud: Boolean = true,
    ): CaptureResult {
        if (showHud) showCameraHud("Capturing…", CameraHudKind.INFO, 3000L)

        return withContext(Dispatchers.IO) {
            try {
                val cameraManager = appContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val cameraId = selectCamera(cameraManager, facing)
                    ?: return@withContext CaptureResult(success = false, error = "No camera available")

                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val outputSize = selectOutputSize(characteristics)

                val imageData = captureImage(cameraManager, cameraId, outputSize.first, outputSize.second)
                    ?: return@withContext CaptureResult(success = false, error = "Capture timed out")

                // Process and encode
                val effectiveQuality = (quality ?: DEFAULT_QUALITY).coerceIn(10, 100)
                val bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.size)
                    ?: return@withContext CaptureResult(success = false, error = "Failed to decode image")

                val scaled = scaleIfNeeded(bitmap, MAX_DIMENSION)
                val base64 = encodeToBase64(scaled, effectiveQuality)
                val thumbnail = encodeToBase64(scaleIfNeeded(scaled, THUMBNAIL_SIZE), 60)

                if (scaled !== bitmap) bitmap.recycle()
                scaled.recycle()

                if (flash) triggerCameraFlash()
                if (showHud) showCameraHud("Photo captured", CameraHudKind.SUCCESS, 2000L)

                Log.i(TAG, "Photo captured: ${base64.length} chars, quality=$effectiveQuality")

                CaptureResult(
                    success = true,
                    base64 = base64,
                    thumbnailBase64 = thumbnail,
                    width = outputSize.first,
                    height = outputSize.second,
                    mimeType = "image/jpeg",
                )
            } catch (e: SecurityException) {
                Log.e(TAG, "Camera permission denied: ${e.message}")
                CaptureResult(success = false, error = "Camera permission denied")
            } catch (e: Exception) {
                Log.e(TAG, "Capture failed: ${e.message}")
                CaptureResult(success = false, error = invokeErrorFromThrowable(e))
            }
        }
    }

    /**
     * Get camera capabilities info.
     */
    fun getCameraInfo(): String {
        return try {
            val cameraManager = appContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameras = cameraManager.cameraIdList.mapNotNull { id ->
                val chars = cameraManager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                val facingName = when (facing) {
                    CameraCharacteristics.LENS_FACING_FRONT -> "front"
                    CameraCharacteristics.LENS_FACING_BACK -> "back"
                    CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
                    else -> "unknown"
                }
                val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                buildJsonObject {
                    put("id", JsonPrimitive(id))
                    put("facing", JsonPrimitive(facingName))
                    put("hasFlash", JsonPrimitive(hasFlash))
                }
            }
            kotlinx.serialization.json.JsonArray(cameras).toString()
        } catch (e: Exception) {
            "[]"
        }
    }

    // MARK: - Private

    private fun selectCamera(manager: CameraManager, facing: String?): String? {
        val targetFacing = when (facing?.trim()?.lowercase()) {
            "front" -> CameraCharacteristics.LENS_FACING_FRONT
            "back" -> CameraCharacteristics.LENS_FACING_BACK
            else -> CameraCharacteristics.LENS_FACING_BACK
        }

        // Try requested facing first
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) return id
        }
        // Fallback to any camera
        return manager.cameraIdList.firstOrNull()
    }

    private fun selectOutputSize(characteristics: CameraCharacteristics): Pair<Int, Int> {
        val configs = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val sizes = configs?.getOutputSizes(ImageFormat.JPEG) ?: return Pair(1920, 1080)

        // Pick largest size within MAX_DIMENSION
        val suitable = sizes
            .filter { it.width <= MAX_DIMENSION && it.height <= MAX_DIMENSION }
            .sortedByDescending { it.width * it.height }

        val best = suitable.firstOrNull() ?: sizes.minByOrNull { it.width * it.height }
        return Pair(best?.width ?: 1920, best?.height ?: 1080)
    }

    private suspend fun captureImage(manager: CameraManager, cameraId: String, width: Int, height: Int): ByteArray? {
        return withTimeoutOrNull(CAPTURE_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val thread = HandlerThread("CameraCapture").apply { start() }
                val handler = Handler(thread.looper)
                val reader = ImageReader.newInstance(width, height, ImageFormat.JPEG, 1)

                reader.setOnImageAvailableListener({ ir ->
                    val image = ir.acquireLatestImage()
                    val buffer = image?.planes?.firstOrNull()?.buffer
                    val data = if (buffer != null) {
                        val bytes = ByteArray(buffer.remaining())
                        buffer.get(bytes)
                        bytes
                    } else null
                    image?.close()
                    reader.close()
                    thread.quitSafely()
                    cont.resume(data)
                }, handler)

                cont.invokeOnCancellation {
                    try { reader.close() } catch (_: Throwable) {}
                    thread.quitSafely()
                }

                try {
                    @Suppress("MissingPermission")
                    manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                        override fun onOpened(device: CameraDevice) {
                            try {
                                val captureBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                                captureBuilder.addTarget(reader.surface)
                                captureBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)

                                device.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
                                    override fun onConfigured(session: CameraCaptureSession) {
                                        try {
                                            session.capture(captureBuilder.build(), null, handler)
                                        } catch (e: Exception) {
                                            device.close()
                                            cont.resume(null)
                                        }
                                    }
                                    override fun onConfigureFailed(session: CameraCaptureSession) {
                                        device.close()
                                        cont.resume(null)
                                    }
                                }, handler)
                            } catch (e: Exception) {
                                device.close()
                                cont.resume(null)
                            }
                        }
                        override fun onDisconnected(device: CameraDevice) { device.close(); cont.resume(null) }
                        override fun onError(device: CameraDevice, error: Int) { device.close(); cont.resume(null) }
                    }, handler)
                } catch (e: Exception) {
                    cont.resume(null)
                }
            }
        }
    }

    private fun scaleIfNeeded(bitmap: Bitmap, maxDim: Int): Bitmap {
        if (bitmap.width <= maxDim && bitmap.height <= maxDim) return bitmap
        val scale = maxDim.toFloat() / maxOf(bitmap.width, bitmap.height)
        val w = (bitmap.width * scale).toInt()
        val h = (bitmap.height * scale).toInt()
        return Bitmap.createScaledBitmap(bitmap, w, h, true)
    }

    private fun encodeToBase64(bitmap: Bitmap, quality: Int): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }
}

data class CaptureResult(
    val success: Boolean,
    val base64: String? = null,
    val thumbnailBase64: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val mimeType: String? = null,
    val error: String? = null,
)
