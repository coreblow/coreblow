/**
 * extensions/compaction.test.ts — Compaction tests
 */
import { describe, it, expect } from 'vitest';
import { resolveCompactionConfig, shouldCompact, buildCompactionMessages, validateCompactionQuality } from './compaction.js';

describe('Compaction', () => {
    describe('resolveCompactionConfig', () => {
        it('returns defaults', () => {
            const config = resolveCompactionConfig();
            expect(config.enabled).toBe(true);
            expect(config.triggerThresholdTokens).toBe(100_000);
            expect(config.qualityCheck).toBe(true);
        });

        it('uses config overrides', () => {
            const config = resolveCompactionConfig({ extensions: { compaction: { triggerThresholdTokens: 50000, enabled: false } } });
            expect(config.triggerThresholdTokens).toBe(50000);
            expect(config.enabled).toBe(false);
        });
    });

    describe('shouldCompact', () => {
        it('triggers above threshold', () => {
            const config = resolveCompactionConfig();
            expect(shouldCompact(200_000, config)).toBe(true);
        });

        it('does not trigger below', () => {
            const config = resolveCompactionConfig();
            expect(shouldCompact(50_000, config)).toBe(false);
        });

        it('disabled', () => {
            expect(shouldCompact(200_000, { ...resolveCompactionConfig(), enabled: false })).toBe(false);
        });
    });

    describe('buildCompactionMessages', () => {
        it('separates to-compact and to-preserve', () => {
            const messages = [
                { role: 'system', content: 'System' },
                ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg-${i}` })),
            ];
            const config = resolveCompactionConfig();
            const result = buildCompactionMessages({ messages, config });
            expect(result.toPreserve.length).toBeGreaterThan(0);
            expect(result.toCompact.length).toBeGreaterThan(0);
            expect(result.toPreserve[0].role).toBe('system');
        });
    });

    describe('validateCompactionQuality', () => {
        it('valid summary', () => {
            const result = validateCompactionQuality('A '.repeat(100), 10000);
            expect(result.valid).toBe(true);
        });

        it('too short', () => {
            expect(validateCompactionQuality('Hi', 10000).valid).toBe(false);
        });

        it('empty', () => {
            expect(validateCompactionQuality('', 10000).valid).toBe(false);
        });
    });
});
