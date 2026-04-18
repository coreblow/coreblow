/**
 * CoreBlow — DateTime Formatting
 *
 * Centralized date/time formatting with timezone support.
 * Uses Intl.DateTimeFormat for locale-aware output.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FormatTimestampOptions {
  /** Include seconds in the output. Default: false */
  displaySeconds?: boolean;
}

export interface FormatZonedTimestampOptions extends FormatTimestampOptions {
  /** IANA timezone string (e.g., 'Asia/Jakarta'). Default: system timezone */
  timeZone?: string;
}

// ─── Timezone Validation ────────────────────────────────────────────────────

/**
 * Validate an IANA timezone string.
 * Returns the string if valid, undefined otherwise.
 */
export function resolveTimezone(value: string): string | undefined {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Get the system's default timezone.
 */
export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ─── UTC Formatting ─────────────────────────────────────────────────────────

/**
 * Format a Date as a UTC timestamp string.
 *
 * Without seconds: `2024-01-15T14:30Z`
 * With seconds:    `2024-01-15T14:30:05Z`
 */
export function formatUtcTimestamp(date: Date, options?: FormatTimestampOptions): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad4 = (n: number) => String(n).padStart(4, '0');

  const yyyy = pad4(date.getUTCFullYear());
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const min = pad2(date.getUTCMinutes());

  if (options?.displaySeconds) {
    const sec = pad2(date.getUTCSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}Z`;
  }
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}

// ─── Zoned Formatting ───────────────────────────────────────────────────────

/**
 * Format a Date with timezone display using Intl.DateTimeFormat.
 *
 * Without seconds: `2024-01-15 14:30 WIB`
 * With seconds:    `2024-01-15 14:30:05 WIB`
 *
 * Returns undefined if Intl formatting fails.
 */
export function formatZonedTimestamp(
  date: Date,
  options?: FormatZonedTimestampOptions,
): string | undefined {
  try {
    const intlOptions: Intl.DateTimeFormatOptions = {
      timeZone: options?.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    };

    if (options?.displaySeconds) {
      intlOptions.second = '2-digit';
    }

    const parts = new Intl.DateTimeFormat('en-US', intlOptions).formatToParts(date);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value;

    const yyyy = pick('year');
    const mm = pick('month');
    const dd = pick('day');
    const hh = pick('hour');
    const min = pick('minute');
    const sec = options?.displaySeconds ? pick('second') : undefined;
    const tz = [...parts]
      .reverse()
      .find((p) => p.type === 'timeZoneName')
      ?.value?.trim();

    if (!yyyy || !mm || !dd || !hh || !min) return undefined;

    const timePart = sec ? `${hh}:${min}:${sec}` : `${hh}:${min}`;
    const tzSuffix = tz ? ` ${tz}` : '';
    return `${yyyy}-${mm}-${dd} ${timePart}${tzSuffix}`;
  } catch {
    return undefined;
  }
}

// ─── Convenience ────────────────────────────────────────────────────────────

/**
 * Format a timestamp (epoch ms) as a human-readable string.
 * Uses UTC if no timezone is specified.
 */
export function formatTimestamp(
  epochMs: number,
  options?: FormatZonedTimestampOptions,
): string {
  const date = new Date(epochMs);
  if (options?.timeZone) {
    return formatZonedTimestamp(date, options) ?? formatUtcTimestamp(date, options);
  }
  return formatUtcTimestamp(date, options);
}

/**
 * Format "now" as an ISO-8601 date string (date only).
 * e.g., "2024-01-15"
 */
export function formatDateOnly(date: Date = new Date()): string {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
