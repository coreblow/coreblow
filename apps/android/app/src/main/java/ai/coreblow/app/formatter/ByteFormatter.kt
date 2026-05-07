package ai.coreblow.app.formatter

import java.text.DecimalFormat
import java.util.Locale
import kotlin.math.log2
import kotlin.math.pow

/**
 * Comprehensive formatting utilities for bytes, durations, numbers,
 * dates, and file sizes used across the UI and diagnostics.
 */
object ByteFormatter {

    private val DECIMAL_FORMAT = DecimalFormat("#,##0.##")

    // ── Byte Formatting ─────────────────────────────────────

    /**
     * Format bytes to human-readable string (KB, MB, GB, TB).
     */
    fun formatBytes(bytes: Long, decimals: Int = 2): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB", "PB")
        val k = 1024.0
        val i = (log2(bytes.toDouble()) / log2(k)).toInt().coerceAtMost(units.size - 1)
        val value = bytes / k.pow(i)
        return "%.${decimals}f %s".format(value, units[i])
    }

    /**
     * Format bytes using SI units (kB, MB, GB).
     */
    fun formatBytesSI(bytes: Long, decimals: Int = 2): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "kB", "MB", "GB", "TB")
        val k = 1000.0
        val i = (log2(bytes.toDouble()) / log2(k)).toInt().coerceAtMost(units.size - 1)
        val value = bytes / k.pow(i)
        return "%.${decimals}f %s".format(value, units[i])
    }

    /**
     * Format bytes as compact string (1.2K, 3.4M, etc).
     */
    fun formatBytesCompact(bytes: Long): String = when {
        bytes < 1024 -> "${bytes}B"
        bytes < 1024 * 1024 -> "%.1fK".format(bytes / 1024.0)
        bytes < 1024L * 1024 * 1024 -> "%.1fM".format(bytes / (1024.0 * 1024))
        else -> "%.1fG".format(bytes / (1024.0 * 1024 * 1024))
    }

    /**
     * Parse a human-readable byte string back to bytes.
     */
    fun parseBytes(value: String): Long? {
        val trimmed = value.trim().uppercase()
        val match = Regex("^([\\d.]+)\\s*(B|KB|MB|GB|TB|PB)?$").find(trimmed) ?: return null
        val number = match.groupValues[1].toDoubleOrNull() ?: return null
        val unit = match.groupValues[2].ifBlank { "B" }
        val multiplier = when (unit) {
            "B" -> 1L
            "KB" -> 1024L
            "MB" -> 1024L * 1024
            "GB" -> 1024L * 1024 * 1024
            "TB" -> 1024L * 1024 * 1024 * 1024
            "PB" -> 1024L * 1024 * 1024 * 1024 * 1024
            else -> 1L
        }
        return (number * multiplier).toLong()
    }

    // ── Duration Formatting ─────────────────────────────────

    /**
     * Format milliseconds to human-readable duration.
     */
    fun formatDuration(ms: Long): String = when {
        ms < 0 -> "—"
        ms < 1000 -> "${ms}ms"
        ms < 60_000 -> "%.1fs".format(ms / 1000.0)
        ms < 3_600_000 -> {
            val min = ms / 60_000
            val sec = (ms % 60_000) / 1000
            "${min}m ${sec}s"
        }
        ms < 86_400_000 -> {
            val hours = ms / 3_600_000
            val min = (ms % 3_600_000) / 60_000
            "${hours}h ${min}m"
        }
        else -> {
            val days = ms / 86_400_000
            val hours = (ms % 86_400_000) / 3_600_000
            "${days}d ${hours}h"
        }
    }

    /**
     * Format duration as compact HH:MM:SS.
     */
    fun formatDurationCompact(ms: Long): String {
        if (ms < 0) return "00:00"
        val totalSec = ms / 1000
        val hours = totalSec / 3600
        val minutes = (totalSec % 3600) / 60
        val seconds = totalSec % 60
        return if (hours > 0) "%02d:%02d:%02d".format(hours, minutes, seconds)
        else "%02d:%02d".format(minutes, seconds)
    }

    /**
     * Format seconds to relative time (e.g., "2 min ago").
     */
    fun formatRelativeTime(timestampMs: Long): String {
        val diffMs = System.currentTimeMillis() - timestampMs
        return when {
            diffMs < 0 -> "in the future"
            diffMs < 60_000 -> "just now"
            diffMs < 3_600_000 -> "${diffMs / 60_000}m ago"
            diffMs < 86_400_000 -> "${diffMs / 3_600_000}h ago"
            diffMs < 604_800_000 -> "${diffMs / 86_400_000}d ago"
            else -> "${diffMs / 604_800_000}w ago"
        }
    }

    // ── Number Formatting ───────────────────────────────────

    /**
     * Format large numbers with suffixes (1.2K, 3.4M, etc).
     */
    fun formatNumber(value: Long): String = when {
        value < 1000 -> "$value"
        value < 1_000_000 -> "%.1fK".format(value / 1000.0)
        value < 1_000_000_000 -> "%.1fM".format(value / 1_000_000.0)
        else -> "%.1fB".format(value / 1_000_000_000.0)
    }

    /**
     * Format with comma separators.
     */
    fun formatWithCommas(value: Long): String = DECIMAL_FORMAT.format(value)

    /**
     * Format a percentage.
     */
    fun formatPercent(value: Double, decimals: Int = 1): String = "%.${decimals}f%%".format(value)

    /**
     * Format token count with price estimate.
     */
    fun formatTokens(tokens: Int, pricePer1k: Double = 0.0): String {
        val formatted = formatNumber(tokens.toLong())
        return if (pricePer1k > 0) {
            val cost = tokens * pricePer1k / 1000
            "$formatted tok ($%.4f)".format(cost)
        } else {
            "$formatted tok"
        }
    }

    /**
     * Format transfer speed (bytes/sec).
     */
    fun formatSpeed(bytesPerSec: Long): String {
        return "${formatBytes(bytesPerSec)}/s"
    }

    /**
     * Format latency with color hint.
     */
    fun formatLatency(ms: Int): String = when {
        ms <= 0 -> "—"
        ms < 50 -> "${ms}ms ●"
        ms < 200 -> "${ms}ms ●"
        else -> "${ms}ms ●"
    }
}
