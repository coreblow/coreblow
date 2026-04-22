import { describe, it, expect } from 'vitest';
import {
    summarizeAllowedValues, isValidAutoReplyMode, isValidSandboxMode,
    isValidLogLevel, isValidChannelId, AUTO_REPLY_MODES, SANDBOX_MODES,
} from './allowed-values.js';

describe('Allowed Values', () => {
    describe('summarizeAllowedValues', () => {
        it('returns null for empty', () => expect(summarizeAllowedValues([])).toBeNull());

        it('summarizes string values', () => {
            const result = summarizeAllowedValues(['a', 'b', 'c']);
            expect(result?.values).toEqual(['a', 'b', 'c']);
            expect(result?.hiddenCount).toBe(0);
        });

        it('deduplicates values', () => {
            const result = summarizeAllowedValues(['a', 'a', 'b']);
            expect(result?.values).toEqual(['a', 'b']);
        });

        it('truncates long lists', () => {
            const values = Array.from({ length: 20 }, (_, i) => `val-${i}`);
            const result = summarizeAllowedValues(values);
            expect(result?.hiddenCount).toBeGreaterThan(0);
            expect(result?.formatted).toContain('more');
        });

        it('handles mixed types', () => {
            const result = summarizeAllowedValues([1, 'two', true, null]);
            expect(result?.values).toHaveLength(4);
        });
    });

    describe('validators', () => {
        it('isValidAutoReplyMode', () => {
            expect(isValidAutoReplyMode('always')).toBe(true);
            expect(isValidAutoReplyMode('mention')).toBe(true);
            expect(isValidAutoReplyMode('invalid')).toBe(false);
            expect(isValidAutoReplyMode(123)).toBe(false);
        });

        it('isValidSandboxMode', () => {
            expect(isValidSandboxMode('off')).toBe(true);
            expect(isValidSandboxMode('all')).toBe(true);
            expect(isValidSandboxMode('invalid')).toBe(false);
        });

        it('isValidLogLevel', () => {
            expect(isValidLogLevel('debug')).toBe(true);
            expect(isValidLogLevel('info')).toBe(true);
            expect(isValidLogLevel('verbose')).toBe(false);
        });

        it('isValidChannelId', () => {
            expect(isValidChannelId('discord')).toBe(true);
            expect(isValidChannelId('telegram')).toBe(true);
            expect(isValidChannelId('unknown')).toBe(false);
        });
    });

    describe('constants', () => {
        it('AUTO_REPLY_MODES has 4 entries', () => expect(AUTO_REPLY_MODES).toHaveLength(4));
        it('SANDBOX_MODES has 3 entries', () => expect(SANDBOX_MODES).toHaveLength(3));
    });
});
