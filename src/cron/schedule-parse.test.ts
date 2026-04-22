import { describe, it, expect } from 'vitest';
import { parseSchedule, listPresets } from './schedule-parse.js';

describe('listPresets', () => {
    it('returns non-empty array', () => {
        const presets = listPresets();
        expect(presets.length).toBeGreaterThan(10);
    });

    it('all presets have label and cronExpr', () => {
        for (const p of listPresets()) {
            expect(p.label).toBeTruthy();
            expect(p.cronExpr).toBeTruthy();
        }
    });

    it('returns a copy (not the original)', () => {
        const a = listPresets();
        const b = listPresets();
        expect(a).not.toBe(b);
    });
});

describe('parseSchedule', () => {
    describe('preset matching', () => {
        it('matches "every minute"', () => {
            const result = parseSchedule('every minute');
            expect(result).not.toBeNull();
            expect(result!.cronExpr).toBe('* * * * *');
        });

        it('matches "every hour"', () => {
            expect(parseSchedule('every hour')!.cronExpr).toBe('0 * * * *');
        });

        it('matches "daily at midnight"', () => {
            expect(parseSchedule('daily at midnight')!.cronExpr).toBe('0 0 * * *');
        });

        it('matches "weekly"', () => {
            expect(parseSchedule('weekly')!.cronExpr).toBe('0 0 * * 0');
        });

        it('is case-insensitive', () => {
            expect(parseSchedule('Every Hour')).not.toBeNull();
        });
    });

    describe('every N unit', () => {
        it('parses "every 5 minutes"', () => {
            const result = parseSchedule('every 5 minutes');
            expect(result!.cronExpr).toBe('*/5 * * * *');
        });

        it('parses "every 2 hours"', () => {
            expect(parseSchedule('every 2 hours')!.cronExpr).toBe('0 */2 * * *');
        });

        it('parses "every 3 days"', () => {
            expect(parseSchedule('every 3 days')!.cronExpr).toBe('0 0 */3 * *');
        });

        it('handles singular unit', () => {
            expect(parseSchedule('every 1 minute')!.cronExpr).toBe('*/1 * * * *');
        });
    });

    describe('daily at H:MM', () => {
        it('parses "daily at 9:00"', () => {
            expect(parseSchedule('daily at 9:00')!.cronExpr).toBe('0 9 * * *');
        });

        it('parses "daily at 2:30 pm"', () => {
            expect(parseSchedule('daily at 2:30 pm')!.cronExpr).toBe('30 14 * * *');
        });

        it('parses "daily at 12:00 am" (midnight)', () => {
            expect(parseSchedule('daily at 12:00 am')!.cronExpr).toBe('0 0 * * *');
        });

        it('parses "daily at 12:00 pm" (noon)', () => {
            expect(parseSchedule('daily at 12:00 pm')!.cronExpr).toBe('0 12 * * *');
        });
    });

    describe('raw cron expression', () => {
        it('passes through raw 5-field cron', () => {
            const result = parseSchedule('0 9 * * 1');
            expect(result!.cronExpr).toBe('0 9 * * 1');
        });
    });

    describe('invalid input', () => {
        it('returns null for empty', () => {
            expect(parseSchedule('')).toBeNull();
        });

        it('returns null for garbage', () => {
            expect(parseSchedule('not a schedule')).toBeNull();
        });
    });
});
