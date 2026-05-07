package ai.coreblow.app.formatter

import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

// ============================================================
// ByteFormatter
// ============================================================

object ByteFormatter {
    fun format(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "%.1f KB".format(bytes / 1024.0)
        bytes < 1024 * 1024 * 1024 -> "%.1f MB".format(bytes / (1024.0 * 1024))
        else -> "%.2f GB".format(bytes / (1024.0 * 1024 * 1024))
    }

    fun formatCompact(bytes: Long): String = when {
        bytes < 1024 -> "${bytes}B"
        bytes < 1024 * 1024 -> "${bytes / 1024}K"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)}M"
        else -> "%.1fG".format(bytes / (1024.0 * 1024 * 1024))
    }
}

// ============================================================
// CostFormatter
// ============================================================

object CostFormatter {
    private val currencyFormat = DecimalFormat("$#,##0.0000")
    private val compactFormat = DecimalFormat("$#,##0.00")

    fun format(costUsd: Double): String = currencyFormat.format(costUsd)
    fun formatCompact(costUsd: Double): String = compactFormat.format(costUsd)

    fun estimateCost(inputTokens: Int, outputTokens: Int, inputPricePer1k: Double = 0.01, outputPricePer1k: Double = 0.03): Double {
        return (inputTokens / 1000.0 * inputPricePer1k) + (outputTokens / 1000.0 * outputPricePer1k)
    }
}

// ============================================================
// DateFormatterCB
// ============================================================

object DateFormatterCB {
    fun formatTime(ms: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))
    fun formatDate(ms: Long): String = SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(ms))
    fun formatFull(ms: Long): String = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault()).format(Date(ms))
    fun formatIso(ms: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date(ms))

    fun formatRelative(ms: Long): String {
        val diff = System.currentTimeMillis() - ms
        val minutes = TimeUnit.MILLISECONDS.toMinutes(diff)
        val hours = TimeUnit.MILLISECONDS.toHours(diff)
        val days = TimeUnit.MILLISECONDS.toDays(diff)
        return when {
            minutes < 1 -> "now"
            minutes < 60 -> "${minutes}m"
            hours < 24 -> "${hours}h"
            days < 7 -> "${days}d"
            else -> formatDate(ms)
        }
    }
}

// ============================================================
// DurationFormatter
// ============================================================

object DurationFormatter {
    fun format(ms: Long): String {
        val seconds = ms / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        return when {
            hours > 0 -> "%dh %02dm %02ds".format(hours, minutes % 60, seconds % 60)
            minutes > 0 -> "%dm %02ds".format(minutes, seconds % 60)
            else -> "${seconds}s"
        }
    }

    fun formatCompact(ms: Long): String {
        val seconds = ms / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        return when {
            hours > 0 -> "${hours}h${minutes % 60}m"
            minutes > 0 -> "${minutes}m${seconds % 60}s"
            seconds > 0 -> "${seconds}s"
            else -> "${ms}ms"
        }
    }

    fun formatAudio(ms: Long): String {
        val totalSeconds = ms / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return "%d:%02d".format(minutes, seconds)
    }
}

// ============================================================
// TokenFormatter
// ============================================================

object TokenFormatter {
    fun format(count: Int): String = when {
        count < 1000 -> "$count"
        count < 1_000_000 -> "%.1fK".format(count / 1000.0)
        else -> "%.1fM".format(count / 1_000_000.0)
    }

    fun formatWithMax(used: Int, max: Int): String = "${format(used)} / ${format(max)}"

    fun formatUsagePercent(used: Int, max: Int): String {
        if (max <= 0) return "—"
        return "${(used * 100 / max)}%"
    }

    fun estimateTokens(text: String): Int {
        // Rough estimate: ~4 chars per token for English
        return (text.length / 4).coerceAtLeast(1)
    }
}
