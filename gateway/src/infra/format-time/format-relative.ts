/**
 * CoreBlow — Relative Time Formatting
 *
 * Human-readable relative time display ("5m ago", "just now", "in 3h").
 * Consolidates scattered age/elapsed/relative functions into two
 * canonical formatters.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FormatTimeAgoOptions {
  /** Append "ago" suffix. Default: true. When false: "5m", "3h" */
  suffix?: boolean;
  /** Return value for invalid/null/negative input. Default: "unknown" */
  fallback?: string;
}

export interface FormatRelativeTimestampOptions {
  /** Fall back to short date for timestamps >7 days. Default: false */
  dateFallback?: boolean;
  /** IANA timezone for date fallback display */
  timezone?: string;
  /** Return value for invalid/null input. Default: "n/a" */
  fallback?: string;
}

// ─── Duration → Text ────────────────────────────────────────────────────────

/**
 * Format a known elapsed duration (in ms) as relative text.
 *
 * Examples:
 * - suffix=true (default):  "just now", "5m ago", "3h ago", "2d ago"
 * - suffix=false:           "0s", "5m", "3h", "2d"
 */
export function formatTimeAgo(
  durationMs: number | null | undefined,
  options?: FormatTimeAgoOptions,
): string {
  const useSuffix = options?.suffix !== false;
  const fallback = options?.fallback ?? 'unknown';

  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return fallback;
  }

  const totalSec = Math.round(durationMs / 1000);
  const min = Math.round(totalSec / 60);

  if (min < 1) {
    return useSuffix ? 'just now' : `${totalSec}s`;
  }
  if (min < 60) {
    return useSuffix ? `${min}m ago` : `${min}m`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return useSuffix ? `${hr}h ago` : `${hr}h`;
  }
  const day = Math.round(hr / 24);
  return useSuffix ? `${day}d ago` : `${day}d`;
}

// ─── Timestamp → Relative Text ──────────────────────────────────────────────

/**
 * Format an epoch timestamp relative to now.
 * Handles both past ("5m ago") and future ("in 5m") timestamps.
 * Optionally falls back to a short date for old timestamps.
 */
export function formatRelativeTimestamp(
  timestampMs: number | null | undefined,
  options?: FormatRelativeTimestampOptions,
): string {
  const fallback = options?.fallback ?? 'n/a';
  if (timestampMs == null || !Number.isFinite(timestampMs)) return fallback;

  const diff = Date.now() - timestampMs;
  const absDiff = Math.abs(diff);
  const isPast = diff >= 0;

  const sec = Math.round(absDiff / 1000);
  if (sec < 60) {
    return isPast ? 'just now' : 'in <1m';
  }

  const min = Math.round(sec / 60);
  if (min < 60) {
    return isPast ? `${min}m ago` : `in ${min}m`;
  }

  const hr = Math.round(min / 60);
  if (hr < 48) {
    return isPast ? `${hr}h ago` : `in ${hr}h`;
  }

  const day = Math.round(hr / 24);
  if (!options?.dateFallback || day <= 7) {
    return isPast ? `${day}d ago` : `in ${day}d`;
  }

  // Fall back to short date for ancient timestamps
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      ...(options.timezone ? { timeZone: options.timezone } : {}),
    }).format(new Date(timestampMs));
  } catch {
    return `${day}d ago`;
  }
}
