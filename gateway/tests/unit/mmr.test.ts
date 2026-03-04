/**
 * tests/unit/mmr.test.ts
 * Tests for MMR reranking and cluster diversity
 */
import { describe, it, expect } from 'vitest';
import { mmrRerank, clusterDiverseRerank, kMeansClustering, euclideanDistance } from '../../src/memory/mmr.js';

function makeResult(score: number, embedding: number[]) {
    return { entry: { text: `score-${score}` }, score, embedding };
}

describe('mmrRerank', () => {
    it('should return all results when fewer than topK', () => {
        const results = [makeResult(0.9, [1, 0]), makeResult(0.8, [0, 1])];
        expect(mmrRerank(results, 0.7, 5).length).toBe(2);
    });

    it('should select topK results', () => {
        const results = Array.from({ length: 20 }, (_, i) =>
            makeResult(1 - i * 0.05, [Math.cos(i), Math.sin(i)])
        );
        expect(mmrRerank(results, 0.7, 5).length).toBe(5);
    });

    it('should pick highest score first', () => {
        const results = [
            makeResult(0.5, [1, 0]),
            makeResult(0.9, [0, 1]),
            makeResult(0.3, [1, 1]),
        ];
        const reranked = mmrRerank(results, 0.7, 2);
        expect(reranked[0].score).toBe(0.9);
    });

    it('should promote diversity with low lambda', () => {
        // Two very similar vectors + one different
        const results = [
            makeResult(0.9, [1, 0, 0]),
            makeResult(0.85, [0.99, 0.01, 0]),
            makeResult(0.7, [0, 1, 0]),
        ];
        const diverse = mmrRerank(results, 0.1, 2); // Low lambda = prefer diversity
        // Should pick the different one over the similar one
        expect(diverse.some(r => r.score === 0.7)).toBe(true);
    });

    it('should prefer relevance with high lambda', () => {
        const results = [
            makeResult(0.9, [1, 0, 0]),
            makeResult(0.85, [0.99, 0.01, 0]),
            makeResult(0.7, [0, 1, 0]),
        ];
        const relevant = mmrRerank(results, 1.0, 2); // High lambda = prefer relevance
        expect(relevant[0].score).toBe(0.9);
        expect(relevant[1].score).toBe(0.85);
    });
});

describe('clusterDiverseRerank', () => {
    it('should return all when fewer than topK', () => {
        const results = [makeResult(0.9, [1, 0])];
        expect(clusterDiverseRerank(results, 3, 5).length).toBe(1);
    });

    it('should select topK results from different clusters', () => {
        // 3 distinct clusters
        const results = [
            makeResult(0.9, [10, 0]),
            makeResult(0.8, [10.1, 0.1]),
            makeResult(0.7, [0, 10]),
            makeResult(0.6, [0.1, 10.1]),
            makeResult(0.5, [-10, -10]),
            makeResult(0.4, [-10.1, -10.1]),
        ];
        const diverse = clusterDiverseRerank(results, 3, 3);
        expect(diverse.length).toBe(3);
    });
});

describe('kMeansClustering', () => {
    it('should assign clusters to vectors', () => {
        const vectors = [
            [0, 0], [1, 0], [0, 1],
            [10, 10], [11, 10], [10, 11],
        ];
        const result = kMeansClustering(vectors, 2, 10);
        expect(result.assignments.length).toBe(6);
        // First 3 should be in same cluster, last 3 in another
        expect(result.assignments[0]).toBe(result.assignments[1]);
        expect(result.assignments[3]).toBe(result.assignments[4]);
    });

    it('should handle single vector', () => {
        const result = kMeansClustering([[1, 2]], 1, 3);
        expect(result.assignments).toEqual([0]);
    });

    it('should handle empty input', () => {
        const result = kMeansClustering([], 2, 3);
        expect(result.assignments).toEqual([]);
    });
});

describe('euclideanDistance', () => {
    it('should compute distance between vectors', () => {
        expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
    });

    it('should return 0 for identical vectors', () => {
        expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    });
});
