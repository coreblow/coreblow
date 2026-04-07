/**
 * CoreBlow Phase 40 — Memory Compaction Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Compaction: age pruning, importance survival, targets
 */
import { describe, it, expect } from 'vitest';
import { MemoryCompactor } from '../../src/memory/compaction.js';

describe('MemoryCompaction — Extended', () => {
    it('should preserve facts regardless of age', () => {
        const compactor = new MemoryCompactor({ maxMemories: 10, targetMemories: 10 });
        const oldFact = { id: '1', text: 'fact', embedding: [], metadata: { timestamp: Date.now() - 365 * 86400000, importance: 0.1, type: 'fact' }};
        const { entries } = compactor.compact([oldFact]);
        expect(entries).toHaveLength(1);
    });

    it('should preserve important memories regardless of age', () => {
        const compactor = new MemoryCompactor({ pruneAgeMs: 1000, keepImportanceThreshold: 0.9, targetMemories: 10 });
        const oldImportant = { id: '2', text: '', embedding: [], metadata: { timestamp: Date.now() - 5000, importance: 0.95 }};
        const { entries } = compactor.compact([oldImportant]);
        expect(entries).toHaveLength(1);
    });

    it('should prune old unimportant memories', () => {
        const compactor = new MemoryCompactor({ pruneAgeMs: 1000, keepImportanceThreshold: 0.8 });
        const oldUnimportant = { id: '3', text: '', embedding: [], metadata: { timestamp: Date.now() - 5000, importance: 0.5 }};
        const fresh = { id: '4', text: '', embedding: [], metadata: { timestamp: Date.now() - 100, importance: 0.5 }};

        const { entries } = compactor.compact([oldUnimportant, fresh]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.id).toBe('4');
    });

    it('should enforce target limits by pruning lowest score first', () => {
        const compactor = new MemoryCompactor({ targetMemories: 2 });
        const now = Date.now();
        const m1 = { id: 'm1', text: '', embedding: [], metadata: { timestamp: now, importance: 0.9 }}; // keep
        const m2 = { id: 'm2', text: '', embedding: [], metadata: { timestamp: now, importance: 0.8 }}; // keep
        const m3 = { id: 'm3', text: '', embedding: [], metadata: { timestamp: now, importance: 0.1 }}; // drop
        const m4 = { id: 'm4', text: '', embedding: [], metadata: { timestamp: now, importance: 0.2 }}; // drop

        const { entries } = compactor.compact([m1, m2, m3, m4]);
        expect(entries).toHaveLength(2);
        const keptIds = entries.map(e => e.id);
        expect(keptIds).toContain('m1');
        expect(keptIds).toContain('m2');
    });

    it('should signal compaction request correctly', () => {
        const c = new MemoryCompactor({ maxMemories: 10 });
        expect(c.shouldCompact(9)).toBe(false);
        expect(c.shouldCompact(10)).toBe(true);
        expect(c.shouldCompact(100)).toBe(true);
    });
});
