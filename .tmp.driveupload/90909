/**
 * CoreBlow Current Time Helper
 *
 * Provides timezone-aware current time formatting and date utilities.
 *
 * Equivalent: CoreBlow src/agents/current-time.ts (40 LOC)
 */

export type TimeFormat = '12h' | '24h';

export interface FormattedTime {
    iso: string;
    display: string;
    timezone: string;
    timestamp: number;
    dayOfWeek: string;
}

/**
 * Get the current time formatted for display
 */
export function getCurrentTime(
    timezone?: string,
    format: TimeFormat = '24h',
): FormattedTime {
    const now = new Date();
    const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    const displayOptions: Intl.DateTimeFormatOptions = {
        timeZone: tz,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: format === '12h',
    };

    const dayOptions: Intl.DateTimeFormatOptions = {
        timeZone: tz,
        weekday: 'long',
    };

    return {
        iso: now.toISOString(),
        display: new Intl.DateTimeFormat('en-US', displayOptions).format(now),
        timezone: tz,
        timestamp: now.getTime(),
        dayOfWeek: new Intl.DateTimeFormat('en-US', dayOptions).format(now),
    };
}

/**
 * Format a timestamp for prompt injection
 */
export function formatTimeForPrompt(timezone?: string): string {
    const time = getCurrentTime(timezone);
    return `${time.dayOfWeek}, ${time.display} (${time.timezone})`;
}

/**
 * Parse a timezone string, returning undefined if invalid
 */
export function validateTimezone(tz: string): string | undefined {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return tz;
    } catch {
        return undefined;
    }
}
