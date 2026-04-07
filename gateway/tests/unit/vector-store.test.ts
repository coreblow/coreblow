/**
 * Tests for the vector store — matches actual VectorStore API
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../src/memory/vector-store.js';

describe('VectorStore', () => {
    let store: VectorStore;
    beforeEach(() => { store = new VectorStore({ maxDocuments: 100 }); });

    it('should start empty', () => {
        expect(store.count()).toBe(0);
    });

    it('should add entries', () => {
        store.add('1', 'hello world', [0.1, 0.2, 0.3]);
        expect(store.count()).toBe(1);
    });

    it('should skip duplicate entries', () => {
        store.add('1', 'hello', [0.1]);
        store.add('1', 'hello updated', [0.2]);
        expect(store.count()).toBe(1); // same ID overwrites
    });

    it('should delete entries by id', () => {
        store.add('1', 'hello', [0.1]);
        store.delete('1');
        expect(store.count()).toBe(0);
    });

    it('should return false when deleting non-existent id', () => {
        expect(store.delete('non-existent')).toBe(false);
    });

    it('should get by id', () => {
        store.add('doc-1', 'hello world', [0.1, 0.2]);
        const doc = store.get('doc-1');
        expect(doc?.content).toBe('hello world');
    });

    it('should search by cosine similarity', () => {
        store.add('1', 'TypeScript', [1, 0, 0]);
        store.add('2', 'JavaScript', [0.9, 0.1, 0]);
        store.add('3', 'Python', [0, 0, 1]);

        const results = store.search([1, 0, 0], { topK: 2 });
        expect(results.length).toBe(2);
        expect(results[0]!.document.content).toBe('TypeScript');
    });

    it('should filter by namespace', () => {
        store.add('1', 'doc1', [0.1], {}, 'ns-a');
        store.add('2', 'doc2', [0.1], {}, 'ns-b');

        const results = store.search([0.1], { namespace: 'ns-a' });
        expect(results.length).toBe(1);
    });

    it('should filter by minScore', () => {
        store.add('1', 'match', [1, 0]);
        store.add('2', 'no-match', [0, 1]);

        const results = store.search([1, 0], { minScore: 0.9 });
        expect(results.length).toBe(1);
    });

    it('should filter by custom filter', () => {
        store.add('1', 'fact', [0.1], { type: 'fact' });
        store.add('2', 'note', [0.1], { type: 'note' });

        const results = store.search([0.1], {
            filter: (doc) => doc.metadata?.type === 'fact',
        });
        expect(results.length).toBe(1);
    });

    it('should count by namespace', () => {
        store.add('1', 'a', [0.1], {}, 'ns1');
        store.add('2', 'b', [0.1], {}, 'ns1');
        store.add('3', 'c', [0.1], {}, 'ns2');
        expect(store.count('ns1')).toBe(2);
    });

    it('should list namespaces', () => {
        store.add('1', 'a', [0.1], {}, 'ns1');
        store.add('2', 'b', [0.1], {}, 'ns2');
        expect(store.listNamespaces()).toContain('ns1');
        expect(store.listNamespaces()).toContain('ns2');
    });

    it('should delete namespace', () => {
        store.add('1', 'a', [0.1], {}, 'ns1');
        store.add('2', 'b', [0.1], {}, 'ns1');
        expect(store.deleteNamespace('ns1')).toBe(2);
        expect(store.count()).toBe(0);
    });

    it('should enforce max documents', () => {
        const small = new VectorStore({ maxDocuments: 2 });
        small.add('1', 'a', [0.1]);
        small.add('2', 'b', [0.1]);
        small.add('3', 'c', [0.1]);
        expect(small.count()).toBe(2);
    });

    it('should clear all', () => {
        store.add('1', 'a', [0.1]);
        store.add('2', 'b', [0.1]);
        store.clear();
        expect(store.count()).toBe(0);
    });
});
