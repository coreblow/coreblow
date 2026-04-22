/**
 * CoreBlow — CLI Parse Duration Tests
 *
 * Tests for parseDurationMs covering single tokens,
 * composite durations, default units, and errors.
 */

import { describe, it, expect } from 'vitest';
import { parseDurationMs } from './parse-duration.js';

describe('parseDurationMs', () => {
    describe('single tokens', () => {
        it('parses milliseconds', () => {
            expect(parseDurationMs('500ms')).toBe(500);
        });

        it('parses seconds', () => {
            expect(parseDurationMs('5s')).toBe(5000);
        });

        it('parses minutes', () => {
            expect(parseDurationMs('2m')).toBe(120_000);
        });

        it('parses hours', () => {
            expect(parseDurationMs('1h')).toBe(3_600_000);
        });

        it('parses days', () => {
            expect(parseDurationMs('1d')).toBe(86_400_000);
        });

        it('handles decimal values', () => {
            expect(parseDurationMs('1.5s')).toBe(1500);
            expect(parseDurationMs('0.5h')).toBe(1_800_000);
        });
    });

    describe('default unit', () => {
        it('uses ms as default unit', () => {
            expect(parseDurationMs('100')).toBe(100);
        });

        it('uses custom default unit', () => {
            expect(parseDurationMs('5', { defaultUnit: 's' })).toBe(5000);
            expect(parseDurationMs('2', { defaultUnit: 'm' })).toBe(120_000);
        });
    });

    describe('composite tokens', () => {
        it('parses "1h30m"', () => {
            expect(parseDurationMs('1h30m')).toBe(5_400_000);
        });

        it('parses "2m500ms"', () => {
            expect(parseDurationMs('2m500ms')).toBe(120_500);
        });

        it('parses "1d12h"', () => {
            expect(parseDurationMs('1d12h')).toBe(129_600_000);
        });
    });

    describe('errors', () => {
        it('throws on empty string', () => {
            expect(() => parseDurationMs('')).toThrow('empty');
        });

        it('throws on invalid input', () => {
            expect(() => parseDurationMs('abc')).toThrow('invalid');
        });

        it('throws on negative values', () => {
            expect(() => parseDurationMs('-5s')).toThrow('invalid');
        });
    });

    describe('whitespace handling', () => {
        it('trims input', () => {
            expect(parseDurationMs('  5s  ')).toBe(5000);
        });

        it('is case-insensitive', () => {
            expect(parseDurationMs('5S')).toBe(5000);
            expect(parseDurationMs('1H')).toBe(3_600_000);
        });
    });
});
