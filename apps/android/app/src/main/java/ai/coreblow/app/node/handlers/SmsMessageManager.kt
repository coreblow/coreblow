package ai.coreblow.app.node.handlers

import android.content.Context
import android.telephony.SmsManager as AndroidSmsManager
import android.util.Log

/**
 * Manages SMS send operations with multi-part message support
 * and delivery tracking for the SmsHandler.
 */
class SmsMessageManager(private val context: Context) {

    companion object {
        private const val TAG = "SmsMessageManager"
        private const val MAX_SINGLE_SMS_LENGTH = 160
    }

    private val smsManager: AndroidSmsManager by lazy {
        context.getSystemService(AndroidSmsManager::class.java)
    }

    /**
     * Send a text message, automatically splitting into multi-part if needed.
     */
    fun sendTextMessage(to: String, body: String): SendResult {
        return try {
            if (body.length <= MAX_SINGLE_SMS_LENGTH) {
                smsManager.sendTextMessage(to, null, body, null, null)
            } else {
                val parts = smsManager.divideMessage(body)
                smsManager.sendMultipartTextMessage(to, null, parts, null, null)
            }
            Log.i(TAG, "SMS sent to $to (${body.length} chars)")
            SendResult(success = true, to = to, parts = if (body.length > MAX_SINGLE_SMS_LENGTH) body.length / MAX_SINGLE_SMS_LENGTH + 1 else 1)
        } catch (e: SecurityException) {
            Log.e(TAG, "SMS permission denied: ${e.message}")
            SendResult(success = false, to = to, error = "Permission denied")
        } catch (e: Exception) {
            Log.e(TAG, "SMS send failed: ${e.message}")
            SendResult(success = false, to = to, error = e.message)
        }
    }
}

data class SendResult(
    val success: Boolean,
    val to: String,
    val parts: Int = 1,
    val error: String? = null,
)
