import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from './vector-store.js';

// Helper: create a simple embedding vector
function makeEmb(seed: number, dims = 8): number[] {
    return Array.from({ length: dims }, (_, i) => Math.sin(seed * (i + 1)));
}

// ═══════════════════════════════════════════════════════════════════
// VectorStore
// ═══════════════════════════════════════════════════════════════════

describe('VectorStore', () => {
    let store: VectorStore;

    beforeEach(() => { store = new VectorStore({ dimensions: 8, maxDocuments: 100 }); });

    // --- CRUD ---
    it('adds a document', () => {
        store.add('doc1', 'Hello world', makeEmb(1));
        expect(store.count()).toBe(1);
    });

    it('gets a document by ID', () => {
        store.add('doc1', 'Hello', makeEmb(1));
        const doc = store.get('doc1');
        expect(doc).not.toBeNull();
        expect(doc!.content).toBe('Hello');
    });

    it('returns null for non-existent doc', () => {
        expect(store.get('nonexistent')).toBeNull();
    });

    it('deletes a document', () => {
        store.add('doc1', 'Hello', makeEmb(1));
        expect(store.delete('doc1')).toBe(true);
        expect(store.count()).toBe(0);
    });

    it('returns false deleting non-existent', () => {
        expect(store.delete('nonexistent')).toBe(false);
    });

    it('clears all documents', () => {
        store.add('doc1', 'a', makeEmb(1));
        store.add('doc2', 'b', makeEmb(2));
        store.clear();
        expect(store.count()).toBe(0);
    });

    // --- Search ---
    it('searches similar documents (cosine similarity)', () => {
        store.add('doc1', 'JavaScript guide', makeEmb(1));
        store.add('doc2', 'Python tutorial', makeEmb(5));
        store.add('doc3', 'JS framework', makeEmb(1.1)); // similar to doc1

        const results = store.search(makeEmb(1), { topK: 2 });
        expect(results).toHaveLength(2);
        expect(results[0].document.id).toBe('doc1'); // most similar
        expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('respects topK limit', () => {
        for (let i = 0; i < 20; i++) store.add(`d${i}`, `doc ${i}`, makeEmb(i));
        const results = store.search(makeEmb(5), { topK: 3 });
        expect(results).toHaveLength(3);
    });

    it('filters by minScore', () => {
        store.add('doc1', 'close', makeEmb(1));
        store.add('doc2', 'far away', makeEmb(100));
        const results = store.search(makeEmb(1), { minScore: 0.99 });
        expect(results.length).toBeLessThanOrEqual(1);
    });

    it('returns scores between -1 and 1', () => {
        store.add('doc1', 'test', makeEmb(1));
        const results = store.search(makeEmb(2));
        expect(results[0].score).toBeGreaterThanOrEqual(-1);
        expect(results[0].score).toBeLessThanOrEqual(1);
    });

    // --- Namespaces ---
    it('filters by namespace', () => {
        store.add('d1', 'a', makeEmb(1), undefined, 'ns1');
        store.add('d2', 'b', makeEmb(1.05), undefined, 'ns2');
        const results = store.search(makeEmb(1), { namespace: 'ns1' });
        expect(results).toHaveLength(1);
        expect(results[0].document.namespace).toBe('ns1');
    });

    it('counts by namespace', () => {
        store.add('d1', 'a', makeEmb(1), undefined, 'ns1');
        store.add('d2', 'b', makeEmb(2), undefined, 'ns1');
        store.add('d3', 'c', makeEmb(3), undefined, 'ns2');
        expect(store.count('ns1')).toBe(2);
        expect(store.count('ns2')).toBe(1);
    });

    it('deletes namespace', () => {
        store.add('d1', 'a', makeEmb(1), undefined, 'ns1');
        store.add('d2', 'b', makeEmb(2), undefined, 'ns1');
        store.add('d3', 'c', makeEmb(3), undefined, 'ns2');
        expect(store.deleteNamespace('ns1')).toBe(2);
        expect(store.count()).toBe(1);
    });

    it('lists namespaces', () => {
        store.add('d1', 'a', makeEmb(1), undefined, 'ns1');
        store.add('d2', 'b', makeEmb(2), undefined, 'ns2');
        store.add('d3', 'c', makeEmb(3));
        const ns = store.listNamespaces();
        expect(ns).toContain('ns1');
        expect(ns).toContain('ns2');
    });

    // --- Metadata ---
    it('stores and retrieves metadata', () => {
        store.add('d1', 'test', makeEmb(1), { author: 'bob', year: 2024 });
        expect(store.get('d1')!.metadata).toEqual({ author: 'bob', year: 2024 });
    });

    // --- Custom Filter ---
    it('uses custom filter in search', () => {
        store.add('d1', 'test', makeEmb(1), { category: 'a' });
        store.add('d2', 'test2', makeEmb(1.01), { category: 'b' });
        const results = store.search(makeEmb(1), {
            filter: (doc) => doc.metadata?.category === 'a',
        });
        expect(results).toHaveLength(1);
        expect(results[0].document.id).toBe('d1');
    });

    // --- Max Documents ---
    it('enforces maxDocuments limit', () => {
        const small = new VectorStore({ maxDocuments: 5, dimensions: 8 });
        for (let i = 0; i < 10; i++) small.add(`d${i}`, `${i}`, makeEmb(i));
        expect(small.count()).toBe(5);
    });

    it('evicts oldest on overflow', () => {
        const small = new VectorStore({ maxDocuments: 3, dimensions: 8 });
        small.add('d0', '0', makeEmb(0));
        small.add('d1', '1', makeEmb(1));
        small.add('d2', '2', makeEmb(2));
        small.add('d3', '3', makeEmb(3)); // should evict d0
        expect(small.get('d0')).toBeNull();
        expect(small.get('d3')).not.toBeNull();
    });

    // --- Edge Cases ---
    it('handles zero-vector embedding', () => {
        store.add('zero', 'empty', new Array(8).fill(0));
        const results = store.search(makeEmb(1));
        expect(results.some(r => r.document.id === 'zero' && r.score === 0)).toBe(true);
    });

    it('handles identical embeddings', () => {
        store.add('d1', 'a', makeEmb(1));
        store.add('d2', 'b', makeEmb(1)); // identical
        const results = store.search(makeEmb(1));
        expect(results[0].score).toBeCloseTo(1);
        expect(results[1].score).toBeCloseTo(1);
    });

    it('handles search on empty store', () => {
        expect(store.search(makeEmb(1))).toHaveLength(0);
    });

    it('handles mismatched dimensions', () => {
        store.add('d1', 'test', [1, 2, 3]); // wrong dims
        const results = store.search(makeEmb(1)); // 8 dims
        expect(results[0].score).toBe(0); // mismatched → 0
    });
});
