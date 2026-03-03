import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore, toFloat32, cosineSimilarityF32 } from './vector-store.js';

// Helper: create a simple embedding of given dimension
function makeEmbedding(dim: number, value: number = 1): Float32Array {
    return new Float32Array(dim).fill(value);
}

// Helper: create a distinguishable embedding
function makeDistinct(dim: number, idx: number): Float32Array {
    const arr = new Float32Array(dim).fill(0);
    arr[idx % dim] = 1;
    return arr;
}

describe('toFloat32', () => {
    it('passes through Float32Array', () => {
        const f = new Float32Array([1, 2, 3]);
        expect(toFloat32(f)).toBe(f);
    });

    it('converts number[] to Float32Array', () => {
        const result = toFloat32([1, 2, 3]);
        expect(result).toBeInstanceOf(Float32Array);
        expect(result[0]).toBe(1);
    });
});

describe('cosineSimilarityF32', () => {
    it('returns 1 for identical vectors', () => {
        const a = new Float32Array([1, 2, 3]);
        expect(cosineSimilarityF32(a, a)).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
        const a = new Float32Array([1, 0]);
        const b = new Float32Array([0, 1]);
        expect(cosineSimilarityF32(a, b)).toBeCloseTo(0, 5);
    });

    it('returns 0 for mismatched lengths', () => {
        expect(cosineSimilarityF32([1, 2], [1, 2, 3])).toBe(0);
    });

    it('returns 0 for zero vectors', () => {
        expect(cosineSimilarityF32([0, 0], [1, 2])).toBe(0);
    });
});

let store: VectorStore;

beforeEach(() => {
    store = new VectorStore({ dimensions: 4 });
});

describe('VectorStore — construction', () => {
    it('starts empty', () => {
        expect(store.count()).toBe(0);
    });
});

describe('VectorStore — add / get', () => {
    it('adds a document and retrieves it', () => {
        const emb = makeEmbedding(4);
        const doc = store.add('doc1', 'test content', emb, { tag: 'a' });
        expect(doc.id).toBe('doc1');
        expect(doc.content).toBe('test content');
        expect(doc.embedding).toBeInstanceOf(Float32Array);
        expect(store.get('doc1')).toBeTruthy();
    });

    it('accepts number[] embeddings', () => {
        const doc = store.add('doc2', 'hello', [1, 2, 3, 4]);
        expect(doc.embedding).toBeInstanceOf(Float32Array);
    });

    it('returns null for unknown id', () => {
        expect(store.get('nonexistent')).toBeNull();
    });
});

describe('VectorStore — search', () => {
    it('finds the most similar document', () => {
        store.add('a', 'match', makeDistinct(4, 0), {}, 'ns1');
        store.add('b', 'other', makeDistinct(4, 1), {}, 'ns1');
        const results = store.search(makeDistinct(4, 0));
        expect(results[0].document.id).toBe('a');
        expect(results[0].score).toBeCloseTo(1, 3);
    });

    it('respects topK', () => {
        for (let i = 0; i < 10; i++) {
            store.add(`d${i}`, `doc ${i}`, makeEmbedding(4, i + 1));
        }
        const results = store.search(makeEmbedding(4, 5), { topK: 3 });
        expect(results).toHaveLength(3);
    });

    it('filters by namespace', () => {
        store.add('a', 'ns-a', makeEmbedding(4), {}, 'alpha');
        store.add('b', 'ns-b', makeEmbedding(4), {}, 'beta');
        const results = store.search(makeEmbedding(4), { namespace: 'alpha' });
        expect(results).toHaveLength(1);
        expect(results[0].document.namespace).toBe('alpha');
    });

    it('respects minScore', () => {
        store.add('a', 'match', makeDistinct(4, 0));
        store.add('b', 'no-match', makeDistinct(4, 1));
        const results = store.search(makeDistinct(4, 0), { minScore: 0.9 });
        expect(results).toHaveLength(1);
    });

    it('applies custom filter', () => {
        store.add('a', 'visible', makeEmbedding(4), { visible: true });
        store.add('b', 'hidden', makeEmbedding(4), { visible: false });
        const results = store.search(makeEmbedding(4), {
            filter: (doc) => doc.metadata?.visible === true,
        });
        expect(results).toHaveLength(1);
        expect(results[0].document.id).toBe('a');
    });
});

describe('VectorStore — delete / deleteNamespace', () => {
    it('deletes a document', () => {
        store.add('x', 'content', makeEmbedding(4));
        expect(store.delete('x')).toBe(true);
        expect(store.count()).toBe(0);
    });

    it('returns false for nonexistent delete', () => {
        expect(store.delete('nope')).toBe(false);
    });

    it('deletes all documents in a namespace', () => {
        store.add('a', 'doc', makeEmbedding(4), {}, 'test-ns');
        store.add('b', 'doc', makeEmbedding(4), {}, 'test-ns');
        store.add('c', 'doc', makeEmbedding(4), {}, 'other');
        const count = store.deleteNamespace('test-ns');
        expect(count).toBe(2);
        expect(store.count()).toBe(1);
    });
});

describe('VectorStore — count / listNamespaces / clear', () => {
    it('counts by namespace', () => {
        store.add('a', 'd', makeEmbedding(4), {}, 'ns1');
        store.add('b', 'd', makeEmbedding(4), {}, 'ns2');
        store.add('c', 'd', makeEmbedding(4), {}, 'ns1');
        expect(store.count('ns1')).toBe(2);
        expect(store.count('ns2')).toBe(1);
        expect(store.count()).toBe(3);
    });

    it('lists namespaces', () => {
        store.add('a', 'd', makeEmbedding(4), {}, 'alpha');
        store.add('b', 'd', makeEmbedding(4), {}, 'beta');
        const ns = store.listNamespaces();
        expect(ns).toContain('alpha');
        expect(ns).toContain('beta');
    });

    it('clears all documents', () => {
        store.add('a', 'd', makeEmbedding(4));
        store.clear();
        expect(store.count()).toBe(0);
    });
});

describe('VectorStore — maxDocuments enforcement', () => {
    it('evicts oldest when limit exceeded', () => {
        const limited = new VectorStore({ maxDocuments: 2, dimensions: 4 });
        limited.add('first', 'a', makeEmbedding(4));
        limited.add('second', 'b', makeEmbedding(4));
        limited.add('third', 'c', makeEmbedding(4));
        expect(limited.count()).toBe(2);
        expect(limited.get('first')).toBeNull(); // evicted
        expect(limited.get('third')).not.toBeNull();
    });
});
