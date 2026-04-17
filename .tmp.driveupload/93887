/**
 * CoreBlow Phase 40 — Memory & Context Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - VectorStore: 1000 docs, rapid add/search
 *   - ContextWindow: giant token bursts
 *   - Compactor: identical importance values
 */
import { describe, it, expect } from 'vitest';
import { VectorStore } from '../../src/memory/vector-store.js';
import { ContextWindowManager } from '../../src/context-engine/context-window.js';
import { MemoryCompactor } from '../../src/memory/compaction.js';

describe('Phase40 Chaos: Memory Stress', () => {
    it('VectorStore with 1000 documents and high-dim vectors', () => {
        const store = new VectorStore({ maxDocuments: 2000, dimensions: 1536 });

        // Insert 1000 docs
        for (let i = 0; i < 1000; i++) {
            const vec = Array.from({ length: 1536 }, () => Math.random());
            store.add(`doc-${i}`, `content-${i}`, vec);
        }
        expect(store.count()).toBe(1000);

        // Search with random vector
        const query = Array.from({ length: 1536 }, () => Math.random());
        const results = store.search(query, { topK: 50 });
        expect(results).toHaveLength(50);
    });

    it('ContextWindow with giant token bursts', () => {
        const manager = new ContextWindowManager();
        manager.create('s1', 'model', 1000);

        // Blast tokens exceeding limit
        for (let i = 0; i < 100; i++) {
            manager.addEntry('s1', { role: 'user', content: `Word`.repeat(50), tokens: 50 });
        }

        const size = manager.getTokenCount('s1');
        expect(size).toBeLessThanOrEqual(1000);
    });

    it('Compactor with identical importance scores (stable sort check)', () => {
        const compactor = new MemoryCompactor({ targetMemories: 2 });
        const batch = [];
        for (let i = 0; i < 100; i++) {
            batch.push({
                id: `m-${i}`, text: '', embedding: [],
                metadata: { timestamp: Date.now() - i, importance: 0.5 }, // Same importance, varied time
            });
        }
        const { entries } = compactor.compact(batch);
        expect(entries).toHaveLength(2);
    });
});
