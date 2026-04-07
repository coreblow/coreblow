/**
 * agents/date-time.ts
 * Date/time formatting for agent prompts and display.
 * Ported from OpenClaw src/agents/date-time.ts.
 */

export type TimeFormat = '12h' | '24h';

export interface ResolvedTimeFormat {
    format: TimeFormat;
    timezone: string;
    locale: string;
}

/**
 * Resolve time format from config/env.
 */
export function resolveTimeFormat(params?: { format?: TimeFormat; timezone?: string; locale?: string }): ResolvedTimeFormat {
    return {
        format: params?.format ?? '24h',
        timezone: params?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: params?.locale ?? 'en-US',
    };
}

/**
 * Format a date for system prompts.
 */
export function formatDateForPrompt(date?: Date, fmt?: ResolvedTimeFormat): string {
    const d = date ?? new Date();
    const f = fmt ?? resolveTimeFormat();
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: f.format === '12h',
        timeZone: f.timezone,
        timeZoneName: 'short',
    };
    return new Intl.DateTimeFormat(f.locale, options).format(d);
}

/**
 * Format a relative time string.
 */
export function formatRelativeTime(ms: number): string {
    const abs = Math.abs(ms);
    if (abs < 1000) return 'just now';
    if (abs < 60_000) return `${Math.floor(abs / 1000)}s ago`;
    if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ago`;
    if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ago`;
    return `${Math.floor(abs / 86_400_000)}d ago`;
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3_600_000) {
        const min = Math.floor(ms / 60_000);
        const sec = Math.floor((ms % 60_000) / 1000);
        return `${min}m ${sec}s`;
    }
    const hr = Math.floor(ms / 3_600_000);
    const min = Math.floor((ms % 3_600_000) / 60_000);
    return `${hr}h ${min}m`;
}

/**
 * Get ISO date string for logging.
 */
export function isoNow(): string {
    return new Date().toISOString();
}

/**
 * Parse timezone offset from string like "+07:00" or "UTC".
 */
export function parseTimezoneOffset(tz: string): number | null {
    if (tz === 'UTC' || tz === 'Z') return 0;
    const match = tz.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
    if (!match) return null;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] ?? '0', 10);
    return sign * (hours * 60 + minutes);
}
