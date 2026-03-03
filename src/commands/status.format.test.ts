import { describe, it, expect } from 'vitest';
import { formatKTokens, formatTokensCompact } from './status.format.js';

describe('formatKTokens', () => {
    it('formats small values with 1 decimal', () => {
        expect(formatKTokens(500)).toBe('0.5k');
        expect(formatKTokens(1500)).toBe('1.5k');
        expect(formatKTokens(9999)).toBe('10.0k');
    });

    it('formats large values with 0 decimals', () => {
        expect(formatKTokens(10_000)).toBe('10k');
        expect(formatKTokens(128_000)).toBe('128k');
        expect(formatKTokens(1_000_000)).toBe('1000k');
    });

    it('handles zero', () => {
        expect(formatKTokens(0)).toBe('0.0k');
    });
});

describe('formatTokensCompact', () => {
    it('formats used/context with percent', () => {
        const result = formatTokensCompact({
            totalTokens: 5000,
            contextTokens: 128_000,
            percentUsed: 4,
            cacheRead: undefined,
            cacheWrite: undefined,
        });
        expect(result).toContain('5.0k');
        expect(result).toContain('128k');
        expect(result).toContain('4%');
    });

    it('handles null totalTokens', () => {
        const result = formatTokensCompact({
            totalTokens: null,
            contextTokens: 128_000,
            percentUsed: null,
            cacheRead: undefined,
            cacheWrite: undefined,
        });
        expect(result).toContain('unknown');
    });

    it('handles no contextTokens', () => {
        const result = formatTokensCompact({
            totalTokens: 5000,
            contextTokens: null,
            percentUsed: null,
            cacheRead: undefined,
            cacheWrite: undefined,
        });
        expect(result).toContain('5.0k used');
    });

    it('shows cache hit rate', () => {
        const result = formatTokensCompact({
            totalTokens: 10_000,
            contextTokens: 128_000,
            percentUsed: 8,
            cacheRead: 5000,
            cacheWrite: 1000,
        });
        expect(result).toContain('cached');
        expect(result).toContain('50%');
    });

    it('skips cache info when cacheRead is 0', () => {
        const result = formatTokensCompact({
            totalTokens: 10_000,
            contextTokens: 128_000,
            percentUsed: 8,
            cacheRead: 0,
            cacheWrite: 0,
        });
        expect(result).not.toContain('cached');
    });
});
