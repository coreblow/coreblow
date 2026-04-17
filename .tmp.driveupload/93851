/**
 * CoreBlow Phase 40 — RAG Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Embed → Store → Search → Retrieve
 */
import { describe, it, expect } from 'vitest';
import { VectorStore } from '../../src/memory/vector-store.js';

describe('Phase40 Chain: RAG Pipeline', () => {
    it('should embed, store, and accurately search documents', () => {
        const store = new VectorStore({ dimensions: 4 });

        // Step 1: Simulated embedding & Store
        store.add('doc-ai', 'AI is transforming the world', [0.9, 0.8, 0.1, 0.0], { subject: 'tech' });
        store.add('doc-cooking', 'How to bake a cake', [0.1, 0.0, 0.8, 0.9], { subject: 'food' });
        store.add('doc-ml', 'Machine learning algorithms', [0.85, 0.75, 0.2, 0.1], { subject: 'tech' });

        // Step 2: Simulated question embedding
        const queryEmbedding = [0.95, 0.85, 0.05, 0.05]; // Similar to AI/ML

        // Step 3: Search
        const results = store.search(queryEmbedding, { minScore: 0.8 });

        // Step 4: Retrieve
        expect(results).toHaveLength(2);
        expect(results[0]?.document.id).toMatch(/doc-(ai|ml)/);
        expect(results[1]?.document.id).toMatch(/doc-(ai|ml)/);
        expect(results.some(r => r.document.id === 'doc-cooking')).toBe(false);
    });

    it('pipeline with namespace isolation', () => {
        const store = new VectorStore();
        store.add('doc1', 'confidential', [1,1,1], {}, 'tenant-A');
        store.add('doc2', 'public', [1,1,1], {}, 'tenant-B');

        const resultsA = store.search([1,1,1], { namespace: 'tenant-A' });
        expect(resultsA).toHaveLength(1);
        expect(resultsA[0]?.document.content).toBe('confidential');
    });

    it('pipeline with hard limit pruning', () => {
        const store = new VectorStore({ maxDocuments: 2 });
        store.add('d1', 'A', [1,0]);
        const start = Date.now(); while (Date.now() === start) {}
        store.add('d2', 'B', [1,0]);
        const start2 = Date.now(); while (Date.now() === start2) {}
        store.add('d3', 'C', [1,0]);

        const results = store.search([1,0]);
        // d1 should be pruned
        expect(results).toHaveLength(2);
        const ids = results.map(r => r.document.id);
        expect(ids).toContain('d2');
        expect(ids).toContain('d3');
        expect(ids).not.toContain('d1');
    });
});
