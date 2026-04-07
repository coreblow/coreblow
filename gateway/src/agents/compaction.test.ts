/**
 * agents/compaction.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
    estimateTokens, estimateMessagesTokens, splitMessagesByTokenShare,
    chunkMessagesByMaxTokens, computeAdaptiveChunkRatio, isOversizedForSummary,
    pruneHistoryForContextShare, createLocalSummary, resolveContextWindowTokens,
    buildCompactionSummarizationInstructions, BASE_CHUNK_RATIO, MIN_CHUNK_RATIO,
    type CompactionMessage,
} from './compaction.js';

function makeMsg(content: string, role = 'user'): CompactionMessage {
    return { role, content, timestamp: Date.now() };
}

describe('Compaction', () => {
    describe('estimateTokens', () => {
        it('estimates ~4 chars/token', () => {
            const tokens = estimateTokens(makeMsg('a'.repeat(100)));
            expect(tokens).toBeGreaterThanOrEqual(25);
            expect(tokens).toBeLessThan(40);
        });
        it('adds overhead', () => {
            expect(estimateTokens(makeMsg(''))).toBeGreaterThan(0);
        });
    });

    describe('estimateMessagesTokens', () => {
        it('sums tokens', () => {
            const msgs = [makeMsg('hello'), makeMsg('world')];
            expect(estimateMessagesTokens(msgs)).toBe(estimateTokens(msgs[0]) + estimateTokens(msgs[1]));
        });
    });

    describe('splitMessagesByTokenShare', () => {
        it('returns empty for empty', () => expect(splitMessagesByTokenShare([])).toEqual([]));
        it('returns single chunk for 1 part', () => {
            const msgs = [makeMsg('a'), makeMsg('b')];
            expect(splitMessagesByTokenShare(msgs, 1)).toHaveLength(1);
        });
        it('splits into N parts', () => {
            const msgs = Array.from({ length: 10 }, (_, i) => makeMsg(`message ${i} content here`));
            const chunks = splitMessagesByTokenShare(msgs, 3);
            expect(chunks.length).toBeGreaterThanOrEqual(2);
            expect(chunks.length).toBeLessThanOrEqual(3);
            expect(chunks.flat()).toHaveLength(10);
        });
    });

    describe('chunkMessagesByMaxTokens', () => {
        it('returns empty for empty', () => expect(chunkMessagesByMaxTokens([], 100)).toEqual([]));
        it('chunks large messages', () => {
            const msgs = Array.from({ length: 5 }, () => makeMsg('x'.repeat(400)));
            const chunks = chunkMessagesByMaxTokens(msgs, 200);
            expect(chunks.length).toBeGreaterThan(1);
        });
        it('keeps small messages together', () => {
            const msgs = [makeMsg('hi'), makeMsg('there')];
            const chunks = chunkMessagesByMaxTokens(msgs, 10000);
            expect(chunks).toHaveLength(1);
        });
    });

    describe('computeAdaptiveChunkRatio', () => {
        it('returns base for empty', () => expect(computeAdaptiveChunkRatio([], 128_000)).toBe(BASE_CHUNK_RATIO));
        it('returns base for small messages', () => {
            const msgs = [makeMsg('hello'), makeMsg('world')];
            expect(computeAdaptiveChunkRatio(msgs, 128_000)).toBe(BASE_CHUNK_RATIO);
        });
        it('reduces for large messages', () => {
            const msgs = [makeMsg('x'.repeat(100_000))];
            const ratio = computeAdaptiveChunkRatio(msgs, 128_000);
            expect(ratio).toBeLessThan(BASE_CHUNK_RATIO);
            expect(ratio).toBeGreaterThanOrEqual(MIN_CHUNK_RATIO);
        });
    });

    describe('isOversizedForSummary', () => {
        it('false for small', () => expect(isOversizedForSummary(makeMsg('hello'), 128_000)).toBe(false));
        it('true for huge', () => expect(isOversizedForSummary(makeMsg('x'.repeat(400_000)), 128_000)).toBe(true));
    });

    describe('pruneHistoryForContextShare', () => {
        it('no-op for small history', () => {
            const msgs = [makeMsg('hi'), makeMsg('there')];
            const result = pruneHistoryForContextShare({ messages: msgs, maxContextTokens: 100_000 });
            expect(result.messages).toHaveLength(2);
            expect(result.droppedCount).toBe(0);
        });
        it('prunes large history', () => {
            const msgs = Array.from({ length: 100 }, (_, i) => makeMsg(`message ${i} with content padding ${'x'.repeat(500)}`));
            const result = pruneHistoryForContextShare({ messages: msgs, maxContextTokens: 5000, maxHistoryShare: 0.5 });
            expect(result.messages.length).toBeLessThan(100);
            expect(result.droppedCount).toBeGreaterThan(0);
        });
    });

    describe('createLocalSummary', () => {
        it('fallback for empty', () => expect(createLocalSummary([])).toContain('No prior'));
        it('summarizes message roles', () => {
            const msgs = [makeMsg('q', 'user'), makeMsg('a', 'assistant')];
            const summary = createLocalSummary(msgs);
            expect(summary).toContain('2 messages');
            expect(summary).toContain('user');
        });
    });

    describe('resolveContextWindowTokens', () => {
        it('defaults to 128k', () => expect(resolveContextWindowTokens()).toBe(128_000));
        it('respects override', () => expect(resolveContextWindowTokens(200_000)).toBe(200_000));
    });

    describe('buildCompactionSummarizationInstructions', () => {
        it('returns identifier preservation by default', () => {
            const result = buildCompactionSummarizationInstructions();
            expect(result).toContain('identifiers');
        });
        it('returns undefined when off and no custom', () => {
            expect(buildCompactionSummarizationInstructions(undefined, { identifierPolicy: 'off' })).toBeUndefined();
        });
        it('combines custom + identifier', () => {
            const result = buildCompactionSummarizationInstructions('focus on code');
            expect(result).toContain('focus on code');
            expect(result).toContain('identifiers');
        });
    });
});
