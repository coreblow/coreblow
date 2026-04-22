import { describe, it, expect } from 'vitest';
import {
    normalizeTimestamp,
    resolveUserTimezone,
    resolveUserTimeFormat,
    formatUserTime,
} from './date-time.js';

describe('normalizeTimestamp', () => {
    it('normalizes Date object', () => {
        const d = new Date('2025-06-15T12:00:00Z');
        const result = normalizeTimestamp(d);
        expect(result).not.toBeUndefined();
        expect(result!.timestampMs).toBe(d.getTime());
        expect(result!.timestampUtc).toBe(d.toISOString());
    });

    it('normalizes epoch ms number', () => {
        const ms = 1718448000000;
        const result = normalizeTimestamp(ms);
        expect(result!.timestampMs).toBe(ms);
    });

    it('normalizes epoch seconds number', () => {
        const sec = 1718448000;
        const result = normalizeTimestamp(sec);
        expect(result!.timestampMs).toBe(sec * 1000);
    });

    it('normalizes ISO string', () => {
        const result = normalizeTimestamp('2025-06-15T12:00:00Z');
        expect(result).not.toBeUndefined();
        expect(result!.timestampUtc).toContain('2025-06-15');
    });

    it('normalizes numeric string (ms)', () => {
        const result = normalizeTimestamp('1718448000000');
        expect(result!.timestampMs).toBe(1718448000000);
    });

    it('normalizes numeric string (seconds)', () => {
        const result = normalizeTimestamp('1718448000');
        expect(result!.timestampMs).toBe(1718448000000);
    });

    it('returns undefined for null', () => {
        expect(normalizeTimestamp(null)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
        expect(normalizeTimestamp('')).toBeUndefined();
    });

    it('returns undefined for invalid string', () => {
        expect(normalizeTimestamp('not-a-date')).toBeUndefined();
    });
});

describe('resolveUserTimezone', () => {
    it('returns configured timezone when valid', () => {
        expect(resolveUserTimezone('America/New_York')).toBe('America/New_York');
    });

    it('returns host timezone for invalid configured', () => {
        const result = resolveUserTimezone('Invalid/Zone');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid/Zone');
    });

    it('returns host timezone when undefined', () => {
        const result = resolveUserTimezone(undefined);
        expect(result).toBeTruthy();
    });
});

describe('resolveUserTimeFormat', () => {
    it('returns "12" when explicitly set', () => {
        expect(resolveUserTimeFormat('12')).toBe('12');
    });

    it('returns "24" when explicitly set', () => {
        expect(resolveUserTimeFormat('24')).toBe('24');
    });

    it('returns detected format for "auto"', () => {
        const result = resolveUserTimeFormat('auto');
        expect(['12', '24']).toContain(result);
    });
});

describe('formatUserTime', () => {
    it('formats date with 24h format', () => {
        const date = new Date('2025-06-15T14:30:00Z');
        const result = formatUserTime(date, 'UTC', '24');
        expect(result).toContain('June');
        expect(result).toContain('15');
        expect(result).toContain('14:30');
    });

    it('formats date with 12h format', () => {
        const date = new Date('2025-06-15T14:30:00Z');
        const result = formatUserTime(date, 'UTC', '12');
        expect(result).toContain('June');
        expect(result).toContain('2:30');
    });

    it('includes ordinal suffix', () => {
        const date = new Date('2025-06-01T12:00:00Z');
        const result = formatUserTime(date, 'UTC', '24');
        expect(result).toContain('1st');
    });
});
