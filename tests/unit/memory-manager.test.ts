/**
 * tests/unit/memory-manager.test.ts
 * Tests for the memory manager
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryManager } from '../../src/memory/manager.js';

// Mock getHomeDir
vi.mock('../../src/gateway/config.js', () => ({
    getHomeDir: () => '/tmp/coreblow-test-' + Date.now(),
}));

describe('MemoryManager', () => {
    let manager: MemoryManager;

    beforeEach(async () => {
        manager = new MemoryManager({
            embeddingBackend: 'local',
            maxMemories: 100,
            autoMemorize: true,
            autoSummarize: true,
        });
        await manager.init();
    });

    it('should initialize with local backend', () => {
        const stats = manager.stats();
        expect(stats.embeddingBackend).toBe('local');
        expect(stats.count).toBe(0);
    });

    it('should store and recall a memory', async () => {
        await manager.store_memory('TypeScript is a typed superset of JavaScript', {
            type: 'fact',
            tags: ['programming'],
        });

        const results = await manager.recall('TypeScript JavaScript');
        expect(results.length).toBeGreaterThan(0);
    });

    it('should forget a memory', async () => {
        const id = await manager.store_memory('temporary note');
        expect(manager.forget(id)).toBe(true);
        expect(manager.forget('non-existent')).toBe(false);
    });

    it('should list recent memories', async () => {
        await manager.store_memory('first');
        await manager.store_memory('second');
        await manager.store_memory('third');

        const recent = manager.recent(2);
        expect(recent.length).toBe(2);
    });

    it('should filter by tag', async () => {
        await manager.store_memory('work task', { tags: ['work'] });
        await manager.store_memory('personal note', { tags: ['personal'] });

        const work = manager.byTag('work');
        expect(work.length).toBe(1);
    });

    it('should extract facts from messages', async () => {
        const ids = await manager.processMessage(
            'My name is John and I work at Google. I was born in 1990.',
            { source: 'telegram', userId: 'john' }
        );
        expect(ids.length).toBeGreaterThan(0);
    });

    it('should extract preferences from messages', async () => {
        const ids = await manager.processMessage(
            'I love TypeScript. I prefer dark mode. My favorite editor is VS Code.',
            { source: 'discord', userId: 'alice' }
        );
        expect(ids.length).toBeGreaterThan(0);
    });

    it('should not duplicate auto-memorized facts', async () => {
        const ids1 = await manager.processMessage(
            'My name is Bob',
            { source: 'test', userId: 'bob' }
        );
        const ids2 = await manager.processMessage(
            'My name is Bob',
            { source: 'test', userId: 'bob' }
        );
        expect(ids2.length).toBe(0); // Already stored
    });

    it('should summarize sessions', async () => {
        const id = await manager.summarizeSession('session-1', [
            { role: 'user', content: 'How do I use TypeScript?' },
            { role: 'assistant', content: 'TypeScript is...' },
            { role: 'user', content: 'What about generics?' },
            { role: 'assistant', content: 'Generics allow...' },
        ]);
        expect(id).toBeTruthy();
    });

    it('should not summarize short sessions', async () => {
        const id = await manager.summarizeSession('session-2', [
            { role: 'user', content: 'hi' },
        ]);
        expect(id).toBeNull();
    });

    it('should build context for system prompt', async () => {
        await manager.store_memory('User prefers dark mode', { type: 'preference' });
        const context = await manager.buildContext('What theme do I prefer?');
        // May or may not find it depending on TF-IDF overlap
        expect(typeof context).toBe('string');
    });

    it('should provide stats', async () => {
        await manager.store_memory('test note');
        const stats = manager.stats();
        expect(stats.count).toBe(1);
        expect(stats.embeddingDimensions).toBe(256);
        expect(stats.autoMemorize).toBe(true);
    });

    it('should keyword search as fallback', async () => {
        await manager.store_memory('The quick brown fox jumps over the lazy dog');
        const results = manager.searchKeyword('brown fox');
        expect(results.length).toBeGreaterThan(0);
    });
});
