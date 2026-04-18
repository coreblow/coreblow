/**
 * agents/date-time.test.ts
 */
import { describe, it, expect } from 'vitest';
import { resolveTimeFormat, formatDateForPrompt, formatRelativeTime, formatDuration, isoNow, parseTimezoneOffset } from './date-time.js';

describe('Date Time', () => {
    describe('resolveTimeFormat', () => {
        it('returns defaults', () => {
            const fmt = resolveTimeFormat();
            expect(fmt.format).toBe('24h');
            expect(fmt.timezone).toBeTruthy();
            expect(fmt.locale).toBe('en-US');
        });
        it('respects overrides', () => {
            const fmt = resolveTimeFormat({ format: '12h', timezone: 'UTC', locale: 'id-ID' });
            expect(fmt.format).toBe('12h');
            expect(fmt.timezone).toBe('UTC');
        });
    });

    describe('formatDateForPrompt', () => {
        it('formats a date', () => {
            const result = formatDateForPrompt(new Date('2026-01-15T10:30:00Z'), { format: '24h', timezone: 'UTC', locale: 'en-US' });
            expect(result).toContain('2026');
            expect(result).toContain('January');
        });
        it('uses current date if not provided', () => {
            const result = formatDateForPrompt();
            expect(result.length).toBeGreaterThan(10);
        });
    });

    describe('formatRelativeTime', () => {
        it('just now', () => expect(formatRelativeTime(500)).toBe('just now'));
        it('seconds', () => expect(formatRelativeTime(5000)).toBe('5s ago'));
        it('minutes', () => expect(formatRelativeTime(120_000)).toBe('2m ago'));
        it('hours', () => expect(formatRelativeTime(7_200_000)).toBe('2h ago'));
        it('days', () => expect(formatRelativeTime(172_800_000)).toBe('2d ago'));
    });

    describe('formatDuration', () => {
        it('ms', () => expect(formatDuration(500)).toBe('500ms'));
        it('seconds', () => expect(formatDuration(2500)).toBe('2.5s'));
        it('minutes', () => expect(formatDuration(125_000)).toBe('2m 5s'));
        it('hours', () => expect(formatDuration(7_320_000)).toBe('2h 2m'));
    });

    describe('isoNow', () => {
        it('returns ISO string', () => {
            const iso = isoNow();
            expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('parseTimezoneOffset', () => {
        it('UTC', () => expect(parseTimezoneOffset('UTC')).toBe(0));
        it('Z', () => expect(parseTimezoneOffset('Z')).toBe(0));
        it('+07:00', () => expect(parseTimezoneOffset('+07:00')).toBe(420));
        it('-05:30', () => expect(parseTimezoneOffset('-05:30')).toBe(-330));
        it('invalid', () => expect(parseTimezoneOffset('xyz')).toBeNull());
    });
});
