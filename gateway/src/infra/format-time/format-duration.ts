/**
 * CoreBlow — Duration Formatting
 *
 * Multiple duration display formats for different UI contexts:
 * - Seconds with decimals (e.g., "1.23s")
 * - Precise with ms threshold (e.g., "500ms", "1.5s")
 * - Compact compound (e.g., "2m5s", "1h30m")
 * - Human-readable single unit (e.g., "3m", "2h", "5d")
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FormatDurationSecondsOptions {
  /** Decimal places for seconds. Default: 1 */
  decimals?: number;
  /** Unit label. Default: 's' */
  unit?: 's' | 'seconds';
}

export interface FormatDurationCompactOptions {
  /** Add space between units: "2m 5s" instead of "2m5s". Default: false */
  spaced?: boolean;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

/**
 * Format milliseconds as decimal seconds.
 *
 * Examples: "0.5s", "1.2s", "45.3s", "3.5 seconds"
 */
export function formatDurationSeconds(
  ms: number,
  options: FormatDurationSecondsOptions = {},
): string {
  if (!Number.isFinite(ms)) return 'unknown';

  const decimals = options.decimals ?? 1;
  const unit = options.unit ?? 's';
  const seconds = Math.max(0, ms) / 1000;
  const fixed = seconds.toFixed(Math.max(0, decimals));
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');

  return unit === 'seconds' ? `${trimmed} seconds` : `${trimmed}s`;
}

/**
 * Precise duration with ms/s threshold.
 *
 * Under 1s: "500ms", "42ms"
 * Over 1s:  "1.23s"
 */
export function formatDurationPrecise(
  ms: number,
  options: FormatDurationSecondsOptions = {},
): string {
  if (!Number.isFinite(ms)) return 'unknown';

  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }

  return formatDurationSeconds(ms, {
    decimals: options.decimals ?? 2,
    unit: options.unit ?? 's',
  });
}

/**
 * Compact compound duration.
 *
 * Examples: "500ms", "45s", "2m5s", "1h30m", "3d12h"
 * With spaced option: "2m 5s", "1h 30m"
 * Omits trailing zero components: "1m" not "1m 0s".
 *
 * Returns undefined for null/invalid/non-positive input.
 */
export function formatDurationCompact(
  ms?: number | null,
  options?: FormatDurationCompactOptions,
): string | undefined {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return undefined;

  if (ms < 1000) return `${Math.round(ms)}ms`;

  const sep = options?.spaced ? ' ' : '';
  const totalSec = Math.round(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d${sep}${remHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${sep}${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m${sep}${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Rounded single-unit duration for display.
 *
 * Examples: "500ms", "5s", "3m", "2h", "5d"
 * Returns fallback for null/invalid input.
 */
export function formatDurationHuman(ms?: number | null, fallback = 'n/a'): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return fallback;

  if (ms < 1000) return `${Math.round(ms)}ms`;

  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;

  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;

  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;

  const day = Math.round(hr / 24);
  return `${day}d`;
}
