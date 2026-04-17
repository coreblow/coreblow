/**
 * CoreBlow Phase 40 — Context & Memory Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Memory → Compact → ContextWindow → Messages
 */
import { describe, it, expect } from 'vitest';
import { MemoryCompactor } from '../../src/memory/compaction.js';
import { ContextWindowManager } from '../../src/context-engine/context-window.js';

describe('Phase40 Chain: Context & Memory Pipeline', () => {
    it('load memories, compact them, apply to context window', () => {
        const now = Date.now();
        // 1. Raw memories loaded from DB
        const rawMemories = [
            { id: 'm1', text: 'Important Fact', embedding: [], metadata: { timestamp: now - 1000, importance: 0.9, type: 'fact' } },
            { id: 'm2', text: 'Old chat', embedding: [], metadata: { timestamp: now - 60 * 86400000, importance: 0.1 } }, // Too old/unimportant
        ];

        // 2. Compact memories (prune)
        const compactor = new MemoryCompactor({ pruneAgeMs: 30 * 86400000 });
        const { entries: keptMemories } = compactor.compact(rawMemories);

        expect(keptMemories).toHaveLength(1);
        expect(keptMemories[0]?.id).toBe('m1');

        // 3. Inject facts into Context Window
        const manager = new ContextWindowManager();
        manager.create('s1', 'gpt-4o');
        manager.addEntry('s1', { role: 'system', content: `Facts: ${keptMemories[0]?.text}`, tokens: 10 });
        manager.addEntry('s1', { role: 'user', content: 'Tell me the fact', tokens: 5 });

        // 4. Extract final LLM context
        const context = manager.getMessages('s1');
        expect(context).toHaveLength(2);
        expect(context[0]?.content).toContain('Important Fact');
    });
});
