/**
 * CoreBlow — RRF (Reciprocal Rank Fusion) Tests
 *
 * Tests for fusing vector and keyword search results.
 */

import { describe, it, expect } from 'vitest';
import { rrfFuse, fuseVectorAndKeyword } from './rrf.js';

describe('rrfFuse', () => {
    it('fuses multiple score arrays into a single ranked list', () => {
        const results = rrfFuse([
            { id: 'a', scores: [0.9, 0.5] },
            { id: 'b', scores: [0.3, 0.8] },
            { id: 'c', scores: [0.1, 0.1] },
        ]);

        expect(results).toHaveLength(3);
        // Each result has an id and score
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('score');
        // Sorted descending by score
        expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
        expect(results[1]!.score).toBeGreaterThanOrEqual(results[2]!.score);
    });

    it('returns empty for empty input', () => {
        expect(rrfFuse([])).toEqual([]);
    });

    it('handles single result', () => {
        const results = rrfFuse([{ id: 'only', scores: [1.0] }]);
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe('only');
    });
});

describe('fuseVectorAndKeyword', () => {
    it('fuses vector and keyword scores for same documents', () => {
        const vector = new Map([['d1', 0.9], ['d2', 0.5]]);
        const keyword = new Map([['d1', 0.3], ['d2', 0.8]]);

        const results = fuseVectorAndKeyword(vector, keyword);
        expect(results).toHaveLength(2);
        // Both have both sources
        expect(results[0]!.sources).toContain('vector');
        expect(results[0]!.sources).toContain('keyword');
    });

    it('includes documents only in vector results', () => {
        const vector = new Map([['v-only', 0.9]]);
        const keyword = new Map<string, number>();

        const results = fuseVectorAndKeyword(vector, keyword);
        expect(results).toHaveLength(1);
        expect(results[0]!.sources).toEqual(['vector']);
    });

    it('includes documents only in keyword results', () => {
        const vector = new Map<string, number>();
        const keyword = new Map([['k-only', 0.8]]);

        const results = fuseVectorAndKeyword(vector, keyword);
        expect(results).toHaveLength(1);
        expect(results[0]!.sources).toEqual(['keyword']);
    });

    it('ranks documents present in both sources higher', () => {
        const vector = new Map([['both', 0.5], ['v-only', 0.9]]);
        const keyword = new Map([['both', 0.5], ['k-only', 0.9]]);

        const results = fuseVectorAndKeyword(vector, keyword);
        // 'both' appears in both sources, should have higher fused score
        expect(results[0]!.id).toBe('both');
    });

    it('returns sorted by score descending', () => {
        const vector = new Map([['a', 0.1], ['b', 0.5], ['c', 0.9]]);
        const keyword = new Map([['a', 0.1], ['b', 0.5], ['c', 0.9]]);

        const results = fuseVectorAndKeyword(vector, keyword);
        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
        }
    });

    it('handles empty inputs', () => {
        const results = fuseVectorAndKeyword(new Map(), new Map());
        expect(results).toEqual([]);
    });
});
