package ai.coreblow.app.node.handlers

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.util.Size
import android.view.Surface
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.*

/**
 * Manages camera capture sessions using Camera2 API.
 * Supports front/back camera selection, quality settings,
 * dimension constraints, and base64 output for gateway.
 */
class CameraCaptureManager(private val context: Context) {

    companion object {
        private const val TAG = "CameraCaptureManager"
        private const val DEFAULT_QUALITY = 80
        private const val DEFAULT_MAX_WIDTH = 1280
        private const val DEFAULT_MAX_HEIGHT = 960
        private const val CAPTURE_TIMEOUT_MS = 10_000L
    }

    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var cameraDevice: CameraDevice? = null
    private var imageReader: ImageReader? = null
    private var isCapturing = false

    /**
     * Capture a single photo and return as base64 JPEG.
     */
    @SuppressLint("MissingPermission")
    suspend fun capturePhoto(
        facing: String = "back",
        quality: Int = DEFAULT_QUALITY,
        maxWidth: Int = DEFAULT_MAX_WIDTH,
        maxHeight: Int = DEFAULT_MAX_HEIGHT,
    ): CaptureResult {
        if (isCapturing) return CaptureResult.Error("Capture already in progress")

        isCapturing = true
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager

        try {
            val cameraId = findCamera(manager, facing)
                ?: return CaptureResult.Error("No ${facing} camera found")

            val characteristics = manager.getCameraCharacteristics(cameraId)
            val outputSize = selectOutputSize(characteristics, maxWidth, maxHeight)

            // Start camera thread
            ensureCameraThread()

            // Open camera
            val device = withTimeoutOrNull(5000L) { openCamera(manager, cameraId) }
                ?: return CaptureResult.Error("Camera open timeout")

            cameraDevice = device

            // Setup image reader
            val reader = ImageReader.newInstance(outputSize.width, outputSize.height, android.graphics.ImageFormat.JPEG, 1)
            imageReader = reader

            // Capture
            val imageData = withTimeoutOrNull(CAPTURE_TIMEOUT_MS) { captureImage(device, reader) }

            // Cleanup
            cleanup()

            if (imageData == null) return CaptureResult.Error("Capture timeout")

            // Apply size limiting
            val base64 = Base64.encodeToString(imageData, Base64.NO_WRAP)
            val limiter = JpegSizeLimiter
            val maxBytes = 500_000 // 500KB max for gateway
            val limited = limiter.limit(base64, maxBytes, minQuality = quality / 2)

            return if (limited != null) {
                CaptureResult.Success(
                    base64 = limited.base64,
                    width = outputSize.width,
                    height = outputSize.height,
                    quality = limited.quality,
                    sizeBytes = limited.sizeBytes,
                    facing = facing,
                )
            } else {
                CaptureResult.Success(
                    base64 = base64,
                    width = outputSize.width,
                    height = outputSize.height,
                    quality = quality,
                    sizeBytes = imageData.size,
                    facing = facing,
                )
            }
        } catch (e: CameraAccessException) {
            Log.e(TAG, "Camera access error: ${e.message}")
            return CaptureResult.Error("Camera access denied: ${e.message}")
        } catch (e: SecurityException) {
            return CaptureResult.Error("Camera permission not granted")
        } catch (e: Exception) {
            Log.e(TAG, "Capture error: ${e.message}")
            return CaptureResult.Error("Capture failed: ${e.message}")
        } finally {
            isCapturing = false
        }
    }

    /**
     * Get available cameras info.
     */
    fun getCameraInfo(): String {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        return buildJsonObject {
            put("cameras", buildJsonArray {
                for (id in manager.cameraIdList) {
                    val chars = manager.getCameraCharacteristics(id)
                    val facing = chars.get(CameraCharacteristics.LENS_FACING)
                    add(buildJsonObject {
                        put("id", id)
                        put("facing", when (facing) {
                            CameraCharacteristics.LENS_FACING_FRONT -> "front"
                            CameraCharacteristics.LENS_FACING_BACK -> "back"
                            else -> "external"
                        })
                        val configs = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                        val sizes = configs?.getOutputSizes(android.graphics.ImageFormat.JPEG)
                        put("maxResolution", sizes?.maxByOrNull { it.width * it.height }?.let { "${it.width}x${it.height}" } ?: "unknown")
                    })
                }
            })
        }.toString()
    }

    // MARK: - Private

    private fun findCamera(manager: CameraManager, facing: String): String? {
        val targetFacing = when (facing.lowercase()) {
            "front", "selfie" -> CameraCharacteristics.LENS_FACING_FRONT
            else -> CameraCharacteristics.LENS_FACING_BACK
        }
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) return id
        }
        return manager.cameraIdList.firstOrNull()
    }

    private fun selectOutputSize(characteristics: CameraCharacteristics, maxW: Int, maxH: Int): Size {
        val configs = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val sizes = configs?.getOutputSizes(android.graphics.ImageFormat.JPEG) ?: return Size(maxW, maxH)
        return sizes
            .filter { it.width <= maxW && it.height <= maxH }
            .maxByOrNull { it.width * it.height }
            ?: sizes.minByOrNull { it.width * it.height }
            ?: Size(maxW, maxH)
    }

    @SuppressLint("MissingPermission")
    private suspend fun openCamera(manager: CameraManager, cameraId: String): CameraDevice {
        val deferred = CompletableDeferred<CameraDevice>()
        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) { deferred.complete(camera) }
            override fun onDisconnected(camera: CameraDevice) { camera.close(); if (deferred.isActive) deferred.completeExceptionally(Exception("Disconnected")) }
            override fun onError(camera: CameraDevice, error: Int) { camera.close(); if (deferred.isActive) deferred.completeExceptionally(Exception("Camera error: $error")) }
        }, cameraHandler)
        return deferred.await()
    }

    private suspend fun captureImage(device: CameraDevice, reader: ImageReader): ByteArray? {
        val deferred = CompletableDeferred<ByteArray?>()
        reader.setOnImageAvailableListener({ ir ->
            val image = ir.acquireLatestImage()
            val buffer = image?.planes?.get(0)?.buffer
            val bytes = buffer?.let { ByteArray(it.remaining()).also { arr -> it.get(arr) } }
            image?.close()
            if (deferred.isActive) deferred.complete(bytes)
        }, cameraHandler)

        val captureRequest = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
            addTarget(reader.surface)
            set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
            set(CaptureRequest.JPEG_QUALITY, DEFAULT_QUALITY.toByte())
        }

        device.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(session: CameraCaptureSession) {
                session.capture(captureRequest.build(), null, cameraHandler)
            }
            override fun onConfigureFailed(session: CameraCaptureSession) {
                if (deferred.isActive) deferred.complete(null)
            }
        }, cameraHandler)

        return deferred.await()
    }

    private fun ensureCameraThread() {
        if (cameraThread == null) {
            cameraThread = HandlerThread("CameraCapture").also { it.start() }
            cameraHandler = Handler(cameraThread!!.looper)
        }
    }

    private fun cleanup() {
        cameraDevice?.close(); cameraDevice = null
        imageReader?.close(); imageReader = null
    }

    fun release() {
        cleanup()
        cameraThread?.quitSafely(); cameraThread = null; cameraHandler = null
    }

    sealed class CaptureResult {
        data class Success(val base64: String, val width: Int, val height: Int, val quality: Int, val sizeBytes: Int, val facing: String) : CaptureResult() {
            fun toJson(): String = buildJsonObject {
                put("base64", base64); put("width", width); put("height", height)
                put("quality", quality); put("sizeBytes", sizeBytes); put("facing", facing)
            }.toString()
        }
        data class Error(val message: String) : CaptureResult() {
            fun toJson(): String = buildJsonObject { put("error", message) }.toString()
        }
    }
}
