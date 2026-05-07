package ai.coreblow.app.utils

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import java.io.File

// ============================================================
// BiometricHelper
// ============================================================

object BiometricHelper {
    fun isAvailable(context: Context): Boolean {
        val bm = BiometricManager.from(context)
        return bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun authenticate(activity: FragmentActivity, title: String = "Authenticate", subtitle: String = "Verify your identity", onSuccess: () -> Unit, onError: (String) -> Unit) {
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeBtnText("Cancel")
            .build()
        val prompt = BiometricPrompt(activity, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { onError(errString.toString()) }
            override fun onAuthenticationFailed() { onError("Authentication failed") }
        })
        prompt.authenticate(promptInfo)
    }

    private fun BiometricPrompt.PromptInfo.Builder.setNegativeBtnText(text: String): BiometricPrompt.PromptInfo.Builder {
        return this.setNegativeButtonText(text)
    }
}

// ============================================================
// DeepLinkHandler
// ============================================================

object DeepLinkHandler {
    fun parse(uri: Uri): DeepLinkResult? {
        return when (uri.host) {
            "chat" -> DeepLinkResult("chat", uri.getQueryParameter("id"))
            "connect" -> DeepLinkResult("connect", uri.getQueryParameter("host"), mapOf("port" to (uri.getQueryParameter("port") ?: "18789")))
            "settings" -> DeepLinkResult("settings", null)
            "voice" -> DeepLinkResult("voice", null)
            else -> null
        }
    }

    data class DeepLinkResult(val route: String, val id: String?, val params: Map<String, String> = emptyMap())
}

// ============================================================
// FileHelper
// ============================================================

object FileHelper {
    fun getFileSize(file: File): Long = if (file.exists()) file.length() else 0
    fun getMimeType(fileName: String): String = when (fileName.substringAfterLast('.').lowercase()) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "mp4" -> "video/mp4"
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "pdf" -> "application/pdf"
        "json" -> "application/json"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    fun getContentUri(context: Context, file: File): Uri {
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun ensureDir(dir: File): File { if (!dir.exists()) dir.mkdirs(); return dir }
    fun getTempFile(context: Context, prefix: String, suffix: String): File = File.createTempFile(prefix, suffix, context.cacheDir)
}

// ============================================================
// ImageHelper
// ============================================================

object ImageHelper {
    fun getImageDimensions(file: File): Pair<Int, Int>? {
        if (!file.exists()) return null
        val options = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(file.absolutePath, options)
        return if (options.outWidth > 0) Pair(options.outWidth, options.outHeight) else null
    }

    fun resizeImage(file: File, maxWidth: Int, maxHeight: Int): android.graphics.Bitmap? {
        val dims = getImageDimensions(file) ?: return null
        val (w, h) = dims
        val scale = minOf(maxWidth.toFloat() / w, maxHeight.toFloat() / h, 1f)
        val newW = (w * scale).toInt()
        val newH = (h * scale).toInt()
        val original = android.graphics.BitmapFactory.decodeFile(file.absolutePath) ?: return null
        val resized = android.graphics.Bitmap.createScaledBitmap(original, newW, newH, true)
        if (resized != original) original.recycle()
        return resized
    }
}

// ============================================================
// LocaleHelper
// ============================================================

object LocaleHelper {
    fun getCurrentLanguage(): String = java.util.Locale.getDefault().language
    fun getCurrentCountry(): String = java.util.Locale.getDefault().country
    fun getLanguageTag(): String = java.util.Locale.getDefault().toLanguageTag()
    fun getDisplayLanguage(): String = java.util.Locale.getDefault().displayLanguage
    fun getTimezone(): String = java.util.TimeZone.getDefault().id
    fun getTimezoneOffset(): Int = java.util.TimeZone.getDefault().rawOffset / 60000
}

// ============================================================
// PermissionHelper
// ============================================================

object PermissionHelper {
    fun isGranted(context: Context, permission: String): Boolean {
        return androidx.core.content.ContextCompat.checkSelfPermission(context, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    fun getMissing(context: Context, permissions: List<String>): List<String> {
        return permissions.filter { !isGranted(context, it) }
    }

    fun allGranted(context: Context, permissions: List<String>): Boolean {
        return permissions.all { isGranted(context, it) }
    }
}

// ============================================================
// PushHandler
// ============================================================

object PushHandler {
    private const val TAG = "PushHandler"

    fun handlePushPayload(data: Map<String, String>): PushAction {
        val type = data["type"] ?: return PushAction.IGNORE
        return when (type) {
            "chat" -> PushAction.OPEN_CHAT
            "voice" -> PushAction.START_VOICE
            "connect" -> PushAction.RECONNECT
            "update" -> PushAction.CHECK_UPDATE
            else -> PushAction.SHOW_NOTIFICATION
        }
    }

    enum class PushAction { OPEN_CHAT, START_VOICE, RECONNECT, CHECK_UPDATE, SHOW_NOTIFICATION, IGNORE }
}

// ============================================================
// ShareHandler
// ============================================================

object ShareHandler {
    fun shareText(context: Context, text: String, title: String = "Share via CoreBlow") {
        val intent = Intent(Intent.ACTION_SEND).apply {
            this.type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        context.startActivity(Intent.createChooser(intent, title))
    }

    fun shareFile(context: Context, file: File, mimeType: String = "application/octet-stream") {
        val uri = FileHelper.getContentUri(context, file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            this.type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share file"))
    }
}
