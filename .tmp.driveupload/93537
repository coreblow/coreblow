/**
 * CoreBlow Phase 40 — Vector Store Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - VectorStore: add, search, cosine similarity, namespaces, limits
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../src/memory/vector-store.js';

describe('VectorStore — Extended', () => {
    let store: VectorStore;

    beforeEach(() => {
        store = new VectorStore({ maxDocuments: 5, dimensions: 3 });
    });

    it('should add document and retrieve it', () => {
        const doc = store.add('doc1', 'Content', [1, 0, 0]);
        expect(doc.id).toBe('doc1');
        expect(doc.content).toBe('Content');
        expect(store.get('doc1')).not.toBeNull();
    });

    it('should enforce maxDocuments limit', () => {
        for (let i = 0; i < 6; i++) {
            store.add(`doc${i}`, 'Content', [1, 0, 0]);
            // adding a small delay to ensure monotonic timestamps
            const start = Date.now(); while (Date.now() === start) {}
        }
        expect(store.count()).toBe(5);
        expect(store.get('doc0')).toBeNull(); // Should be dropped
        expect(store.get('doc5')).not.toBeNull();
    });

    it('should search using cosine similarity', () => {
        store.add('d1', 'apple', [1, 0, 0]);
        store.add('d2', 'banana', [0, 1, 0]);
        store.add('d3', 'orange', [0.8, 0.2, 0]);

        const res = store.search([1, 0, 0], { topK: 2 });
        expect(res).toHaveLength(2);
        expect(res[0]?.document.id).toBe('d1'); // perfect match
        expect(res[1]?.document.id).toBe('d3'); // close match
    });

    it('should isolate by namespace', () => {
        store.add('ns1-d1', 'hello', [1, 1, 1], {}, 'ns1');
        store.add('ns2-d1', 'world', [1, 1, 1], {}, 'ns2');

        const res1 = store.search([1, 1, 1], { namespace: 'ns1' });
        expect(res1).toHaveLength(1);
        expect(res1[0]?.document.id).toBe('ns1-d1');

        expect(store.count('ns1')).toBe(1);
        expect(store.count('ns2')).toBe(1);
    });

    it('should list all namespaces', () => {
        store.add('a', 'a', [0,0,0], {}, 'ns-A');
        store.add('b', 'b', [0,0,0], {}, 'ns-B');
        const list = store.listNamespaces();
        expect(list).toContain('ns-A');
        expect(list).toContain('ns-B');
    });

    it('should delete namespace', () => {
        store.add('a', 'a', [1,1,1], {}, 'ns-A');
        store.add('b', 'b', [1,1,1], {}, 'ns-B');
        const deletedCount = store.deleteNamespace('ns-A');
        expect(deletedCount).toBe(1);
        expect(store.get('a')).toBeNull();
        expect(store.get('b')).not.toBeNull();
    });

    it('should filter search results custom callback', () => {
        store.add('d1', 'a', [1, 1, 1], { kind: 'fruit' });
        store.add('d2', 'b', [1, 1, 1], { kind: 'animal' });

        const res = store.search([1, 1, 1], {
            filter: (d) => d.metadata?.kind === 'fruit',
        });
        expect(res).toHaveLength(1);
        expect(res[0]?.document.id).toBe('d1');
    });

    it('should apply minScore threshold', () => {
        store.add('d1', 'exact', [1, 0, 0]);
        store.add('d2', 'none', [0, 1, 0]); // orthogonal -> 0 score

        const res = store.search([1, 0, 0], { minScore: 0.5 });
        expect(res).toHaveLength(1);
        expect(res[0]?.document.id).toBe('d1');
    });

    it('should handle zero-vector gracefully', () => {
        store.add('d1', 'zero', [0, 0, 0]);
        const res = store.search([0, 0, 0]);
        // Search against zero vector gives score 0
        expect(res[0]?.score).toBe(0);
    });

    it('should clear all documents', () => {
        store.add('d1', '', [1, 1, 1]);
        store.clear();
        expect(store.count()).toBe(0);
    });
});
