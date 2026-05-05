package ai.coreblow.app.voice

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlin.math.sqrt

/**
 * Manages microphone audio capture for voice wake and talk mode.
 *
 * Provides PCM audio buffers and basic VAD (Voice Activity Detection)
 * via RMS amplitude analysis.
 */
class MicCaptureManager {

    companion object {
        private const val TAG = "MicCaptureManager"
    }

    private var audioRecord: AudioRecord? = null
    private val bufferSize: Int by lazy {
        val minSize = AudioRecord.getMinBufferSize(
            TalkDefaults.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        maxOf(minSize, TalkDefaults.MIN_BUFFER_SIZE)
    }

    val isRecording: Boolean
        get() = audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING

    /**
     * Start audio capture. Call [stopCapture] when done.
     */
    @SuppressLint("MissingPermission")
    fun startCapture(): Boolean {
        if (isRecording) return true

        return try {
            val record = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                TalkDefaults.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize")
                record.release()
                return false
            }

            record.startRecording()
            audioRecord = record
            Log.i(TAG, "Mic capture started (buffer=$bufferSize)")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Mic permission denied: ${e.message}")
            false
        }
    }

    /**
     * Stop audio capture and release resources.
     */
    fun stopCapture() {
        audioRecord?.let { record ->
            try {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    record.stop()
                }
                record.release()
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping capture: ${e.message}")
            }
        }
        audioRecord = null
        Log.i(TAG, "Mic capture stopped")
    }

    /**
     * Read a buffer of PCM audio data.
     * Returns null if capture is not active.
     */
    fun readBuffer(): ShortArray? {
        val record = audioRecord ?: return null
        val buffer = ShortArray(bufferSize / 2)
        val read = record.read(buffer, 0, buffer.size)
        return if (read > 0) buffer.copyOf(read) else null
    }

    /**
     * Continuously read audio and invoke [onBuffer] for each chunk.
     * Runs until cancelled or capture is stopped.
     */
    suspend fun captureLoop(onBuffer: (ShortArray, Double) -> Unit) {
        withContext(Dispatchers.IO) {
            while (isActive && isRecording) {
                val buffer = readBuffer() ?: break
                val rms = calculateRms(buffer)
                onBuffer(buffer, rms)
            }
        }
    }

    /**
     * Calculate RMS amplitude of an audio buffer for VAD.
     */
    fun calculateRms(buffer: ShortArray): Double {
        if (buffer.isEmpty()) return 0.0
        var sum = 0.0
        for (sample in buffer) {
            sum += sample.toDouble() * sample.toDouble()
        }
        return sqrt(sum / buffer.size)
    }

    /**
     * Check if the RMS value indicates speech activity.
     */
    fun isSpeechDetected(rms: Double): Boolean {
        return rms > TalkDefaults.SILENCE_THRESHOLD_RMS
    }
}
