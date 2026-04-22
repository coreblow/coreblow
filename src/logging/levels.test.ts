/**
 * CoreBlow — Logging Levels Tests
 *
 * Tests for tryParseLogLevel, normalizeLogLevel, and levelToMinLevel.
 */

import { describe, it, expect } from 'vitest';
import { ALLOWED_LOG_LEVELS, tryParseLogLevel, normalizeLogLevel, levelToMinLevel } from './levels.js';

describe('ALLOWED_LOG_LEVELS', () => {
    it('contains all expected levels', () => {
        expect(ALLOWED_LOG_LEVELS).toContain('silent');
        expect(ALLOWED_LOG_LEVELS).toContain('fatal');
        expect(ALLOWED_LOG_LEVELS).toContain('error');
        expect(ALLOWED_LOG_LEVELS).toContain('warn');
        expect(ALLOWED_LOG_LEVELS).toContain('info');
        expect(ALLOWED_LOG_LEVELS).toContain('debug');
        expect(ALLOWED_LOG_LEVELS).toContain('trace');
    });
});

describe('tryParseLogLevel', () => {
    it('parses valid levels', () => {
        expect(tryParseLogLevel('info')).toBe('info');
        expect(tryParseLogLevel('debug')).toBe('debug');
        expect(tryParseLogLevel('error')).toBe('error');
    });

    it('returns undefined for invalid level', () => {
        expect(tryParseLogLevel('verbose')).toBeUndefined();
    });

    it('returns undefined for non-string', () => {
        expect(tryParseLogLevel(undefined)).toBeUndefined();
    });

    it('trims whitespace', () => {
        expect(tryParseLogLevel('  info  ')).toBe('info');
    });
});

describe('normalizeLogLevel', () => {
    it('returns valid level', () => {
        expect(normalizeLogLevel('debug')).toBe('debug');
    });

    it('returns fallback for invalid', () => {
        expect(normalizeLogLevel('invalid')).toBe('info');
    });

    it('uses custom fallback', () => {
        expect(normalizeLogLevel('invalid', 'warn')).toBe('warn');
    });

    it('returns fallback for undefined', () => {
        expect(normalizeLogLevel(undefined)).toBe('info');
    });
});

describe('levelToMinLevel', () => {
    it('maps fatal to 0', () => {
        expect(levelToMinLevel('fatal')).toBe(0);
    });

    it('maps error to 1', () => {
        expect(levelToMinLevel('error')).toBe(1);
    });

    it('maps info to 3', () => {
        expect(levelToMinLevel('info')).toBe(3);
    });

    it('maps trace to 5', () => {
        expect(levelToMinLevel('trace')).toBe(5);
    });

    it('maps silent to Infinity', () => {
        expect(levelToMinLevel('silent')).toBe(Number.POSITIVE_INFINITY);
    });

    it('ordering: fatal < error < warn < info < debug < trace', () => {
        expect(levelToMinLevel('fatal')).toBeLessThan(levelToMinLevel('error'));
        expect(levelToMinLevel('error')).toBeLessThan(levelToMinLevel('warn'));
        expect(levelToMinLevel('warn')).toBeLessThan(levelToMinLevel('info'));
        expect(levelToMinLevel('info')).toBeLessThan(levelToMinLevel('debug'));
        expect(levelToMinLevel('debug')).toBeLessThan(levelToMinLevel('trace'));
    });
});
