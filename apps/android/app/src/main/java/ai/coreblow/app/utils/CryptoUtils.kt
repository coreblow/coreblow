package ai.coreblow.app.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

// ============================================================
// CryptoUtils
// ============================================================

object CryptoUtils {
    fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    fun sha256Bytes(input: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input).joinToString("") { "%02x".format(it) }
    }

    fun md5(input: String): String {
        val digest = MessageDigest.getInstance("MD5")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    fun generateRandomHex(byteCount: Int = 16): String {
        val bytes = ByteArray(byteCount)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun encryptAes(data: String, key: ByteArray): String {
        val iv = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        val encrypted = cipher.doFinal(data.toByteArray())
        return Base64.encodeToString(iv + encrypted, Base64.NO_WRAP)
    }

    fun decryptAes(data: String, key: ByteArray): String? {
        return try {
            val decoded = Base64.decode(data, Base64.NO_WRAP)
            val iv = decoded.copyOfRange(0, 16)
            val encrypted = decoded.copyOfRange(16, decoded.size)
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
            String(cipher.doFinal(encrypted))
        } catch (_: Throwable) { null }
    }
}

// ============================================================
// DateUtils
// ============================================================

object DateUtils {
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    fun toIso(ms: Long): String = isoFormat.format(Date(ms))
    fun fromIso(iso: String): Long? = try { isoFormat.parse(iso)?.time } catch (_: Throwable) { null }
    fun now(): String = toIso(System.currentTimeMillis())

    fun formatRelative(ms: Long): String {
        val diff = System.currentTimeMillis() - ms
        val seconds = diff / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        val days = hours / 24
        return when {
            seconds < 60 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            days < 7 -> "${days}d ago"
            else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(ms))
        }
    }

    fun formatTime(ms: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))
    fun formatDate(ms: Long): String = SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(ms))
    fun formatDateTime(ms: Long): String = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(Date(ms))
}

// ============================================================
// StringUtils
// ============================================================

object StringUtils {
    fun truncate(text: String, maxLen: Int = 200, ellipsis: String = "…"): String {
        return if (text.length > maxLen) text.take(maxLen - ellipsis.length) + ellipsis else text
    }

    fun capitalize(text: String): String = text.replaceFirstChar { it.uppercase() }

    fun initials(name: String, maxChars: Int = 2): String {
        return name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(maxChars).joinToString("")
    }

    fun isValidEmail(email: String): Boolean = android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    fun isValidUrl(url: String): Boolean = android.util.Patterns.WEB_URL.matcher(url).matches()

    fun stripMarkdown(text: String): String {
        return text
            .replace(Regex("#+\\s*"), "")
            .replace(Regex("\\*\\*(.*?)\\*\\*"), "$1")
            .replace(Regex("\\*(.*?)\\*"), "$1")
            .replace(Regex("~~(.*?)~~"), "$1")
            .replace(Regex("`(.*?)`"), "$1")
            .replace(Regex("\\[([^]]+)]\\([^)]+\\)"), "$1")
            .replace(Regex("^[-*+]\\s+", RegexOption.MULTILINE), "")
            .replace(Regex("^>\\s*", RegexOption.MULTILINE), "")
            .trim()
    }

    fun wordCount(text: String): Int = text.trim().split(Regex("\\s+")).count { it.isNotEmpty() }
}

// ============================================================
// NetworkUtils
// ============================================================

object NetworkUtils {
    fun isConnected(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        return caps != null
    }

    fun isWifi(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        return caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }

    fun isCellular(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        return caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true
    }

    fun isMetered(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.isActiveNetworkMetered
    }

    fun getConnectionType(context: Context): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            else -> "unknown"
        }
    }
}

// ============================================================
// StorageUtils
// ============================================================

object StorageUtils {
    fun getAvailableStorageMb(): Long {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        return stat.availableBytes / (1024 * 1024)
    }

    fun getTotalStorageMb(): Long {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        return stat.totalBytes / (1024 * 1024)
    }

    fun getUsedStoragePercent(): Int {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        val used = stat.totalBytes - stat.availableBytes
        return ((used * 100) / stat.totalBytes).toInt()
    }

    fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return "%.1f KB".format(kb)
        val mb = kb / 1024.0
        if (mb < 1024) return "%.1f MB".format(mb)
        return "%.2f GB".format(mb / 1024.0)
    }

    fun getCacheSize(context: Context): Long {
        return context.cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
    }

    fun clearCache(context: Context): Int {
        var count = 0
        context.cacheDir.walkTopDown().filter { it.isFile }.forEach { if (it.delete()) count++ }
        return count
    }
}

// ============================================================
// MarkdownUtils
// ============================================================

object MarkdownUtils {
    fun hasCodeBlocks(text: String): Boolean = text.contains("```")
    fun hasLinks(text: String): Boolean = text.contains(Regex("\\[.*]\\(.*\\)"))
    fun hasBold(text: String): Boolean = text.contains("**")
    fun hasItalic(text: String): Boolean = text.contains(Regex("(?<!\\*)\\*(?!\\*)"))
    fun hasHeaders(text: String): Boolean = text.contains(Regex("^#+\\s", RegexOption.MULTILINE))
    fun hasList(text: String): Boolean = text.contains(Regex("^[-*+]\\s", RegexOption.MULTILINE))

    fun extractCodeBlocks(text: String): List<Pair<String?, String>> {
        val blocks = mutableListOf<Pair<String?, String>>()
        val regex = Regex("```(\\w*)\\n(.*?)```", RegexOption.DOT_MATCHES_ALL)
        regex.findAll(text).forEach { match ->
            val lang = match.groupValues[1].ifBlank { null }
            blocks.add(Pair(lang, match.groupValues[2].trim()))
        }
        return blocks
    }

    fun extractLinks(text: String): List<Pair<String, String>> {
        val links = mutableListOf<Pair<String, String>>()
        val regex = Regex("\\[([^]]+)]\\(([^)]+)\\)")
        regex.findAll(text).forEach { match ->
            links.add(Pair(match.groupValues[1], match.groupValues[2]))
        }
        return links
    }
}

// ============================================================
// ThemeUtils
// ============================================================

object ThemeUtils {
    fun isDarkMode(context: Context): Boolean {
        val uiMode = context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return uiMode == android.content.res.Configuration.UI_MODE_NIGHT_YES
    }

    fun getScreenWidthDp(context: Context): Int = context.resources.configuration.screenWidthDp
    fun getScreenHeightDp(context: Context): Int = context.resources.configuration.screenHeightDp
    fun isTablet(context: Context): Boolean = context.resources.configuration.smallestScreenWidthDp >= 600
    fun isLandscape(context: Context): Boolean = context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
}
