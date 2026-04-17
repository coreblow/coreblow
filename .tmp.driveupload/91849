/**
 * extensions/context-pruning.test.ts — Context pruning tests
 */
import { describe, it, expect } from 'vitest';
import { resolvePruningSettings, pruneContextSlidingWindow } from './context-pruning.js';

describe('Context Pruning', () => {
    describe('resolvePruningSettings', () => {
        it('returns defaults', () => {
            const settings = resolvePruningSettings();
            expect(settings.maxContextTokens).toBe(128_000);
            expect(settings.strategy).toBe('sliding-window');
            expect(settings.preserveRecentCount).toBe(5);
        });

        it('uses config overrides', () => {
            const settings = resolvePruningSettings({ extensions: { contextPruning: { maxContextTokens: 64000, strategy: 'summarize' } } });
            expect(settings.maxContextTokens).toBe(64000);
            expect(settings.strategy).toBe('summarize');
        });
    });

    describe('pruneContextSlidingWindow', () => {
        it('keeps all messages within budget', () => {
            const messages = [
                { role: 'system', content: 'You are helpful.' },
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi!' },
            ];
            const settings = resolvePruningSettings();
            const { messages: pruned, result } = pruneContextSlidingWindow(messages, settings);
            expect(pruned).toHaveLength(3);
            expect(result.removed).toBe(0);
        });

        it('removes old messages when over budget', () => {
            const messages = [
                { role: 'system', content: 'S' },
                ...Array.from({ length: 50 }, (_, i) => ({
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: 'X'.repeat(2000),
                })),
            ];
            const settings = { ...resolvePruningSettings(), maxContextTokens: 1000, reserveTokens: 100 };
            const { messages: pruned, result } = pruneContextSlidingWindow(messages, settings);
            expect(result.removed).toBeGreaterThan(0);
            expect(pruned[0].role).toBe('system');
        });

        it('preserves system messages', () => {
            const messages = [
                { role: 'system', content: 'Important instructions' },
                ...Array.from({ length: 20 }, () => ({ role: 'user', content: 'Long message '.repeat(100) })),
            ];
            const settings = { ...resolvePruningSettings(), maxContextTokens: 500 };
            const { messages: pruned } = pruneContextSlidingWindow(messages, settings);
            expect(pruned[0].role).toBe('system');
        });

        it('preserves recent messages', () => {
            const messages = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg-${i}` }));
            const settings = { ...resolvePruningSettings(), maxContextTokens: 100, preserveRecentCount: 3 };
            const { messages: pruned } = pruneContextSlidingWindow(messages, settings);
            expect(pruned[pruned.length - 1].content).toBe('msg-19');
        });
    });
});
