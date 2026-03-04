/**
 * tests/unit/vector-store.test.ts
 * Tests for the vector store
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStore, type MemoryEntry } from '../../src/memory/vector-store.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function makeTmpPath(): string {
    return path.join(os.tmpdir(), `coreblow-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
    return {
        id: Math.random().toString(36).slice(2, 10),
        text: overrides.text || 'Test memory entry',
        embedding: overrides.embedding || new Array(256).fill(0).map(() => Math.random()),
        metadata: {
            source: 'test',
            timestamp: Date.now(),
            tags: [],
            type: 'note',
            importance: 0.5,
            ...overrides.metadata,
        },
        ...overrides,
    };
}

describe('VectorStore', () => {
    let storePath: string;
    let store: VectorStore;

    beforeEach(() => {
        storePath = makeTmpPath();
        store = new VectorStore(storePath);
    });

    afterEach(() => {
        store.close();
        if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
    });

    it('should start empty', () => {
        expect(store.size).toBe(0);
    });

    it('should add entries', async () => {
        await store.add(makeEntry());
        expect(store.size).toBe(1);
    });

    it('should skip duplicate entries', async () => {
        const entry = makeEntry({ text: 'duplicate test' });
        await store.add(entry);
        await store.add({ ...entry, id: 'different-id' });
        expect(store.size).toBe(1);
    });

    it('should delete entries by id', async () => {
        const entry = makeEntry();
        await store.add(entry);
        expect(store.size).toBe(1);
        store.delete(entry.id);
        expect(store.size).toBe(0);
    });

    it('should return false when deleting non-existent id', () => {
        expect(store.delete('non-existent')).toBe(false);
    });

    it('should get recent entries', async () => {
        for (let i = 0; i < 5; i++) {
            await store.add(makeEntry({ text: `entry ${i}` }));
        }
        const recent = store.getRecent(3);
        expect(recent.length).toBe(3);
    });

    it('should search by keyword', async () => {
        await store.add(makeEntry({ text: 'TypeScript is a programming language' }));
        await store.add(makeEntry({ text: 'Python is great for data science' }));
        await store.add(makeEntry({ text: 'TypeScript and JavaScript are related' }));

        const results = store.searchByKeyword('TypeScript');
        expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by tags', async () => {
        await store.add(makeEntry({ metadata: { source: 'test', timestamp: Date.now(), tags: ['work'], type: 'note', importance: 0.5 } }));
        await store.add(makeEntry({ metadata: { source: 'test', timestamp: Date.now(), tags: ['personal'], type: 'note', importance: 0.5 } }));

        const workMemories = store.getByTag('work');
        expect(workMemories.length).toBe(1);
    });

    it('should filter by user', async () => {
        await store.add(makeEntry({ metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'note', importance: 0.5, userId: 'alice' } }));
        await store.add(makeEntry({ metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'note', importance: 0.5, userId: 'bob' } }));

        const aliceMemories = store.getByUser('alice');
        expect(aliceMemories.length).toBe(1);
    });

    it('should prune old entries', async () => {
        const oldEntry = makeEntry();
        oldEntry.metadata.timestamp = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days ago
        await store.add(oldEntry);
        await store.add(makeEntry()); // Recent

        const pruned = store.pruneOld(30 * 24 * 60 * 60 * 1000); // 30 days
        expect(pruned).toBe(1);
        expect(store.size).toBe(1);
    });

    it('should persist to disk and reload', async () => {
        await store.add(makeEntry({ text: 'persistent memory' }));
        store.save();

        const store2 = new VectorStore(storePath);
        expect(store2.size).toBe(1);
        store2.close();
    });

    it('should return stats', async () => {
        await store.add(makeEntry({ text: 'fact entry unique one', metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'fact', importance: 0.5 } }));
        await store.add(makeEntry({ text: 'note entry unique two', metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'note', importance: 0.5 } }));

        const stats = store.stats();
        expect(stats.count).toBe(2);
        expect(stats.types.fact).toBe(1);
        expect(stats.types.note).toBe(1);
    });

    it('should perform semantic search with filter', async () => {
        const embedding = new Array(256).fill(0.1);
        await store.add(makeEntry({ embedding, metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'fact', importance: 0.5 } }));
        await store.add(makeEntry({ embedding, metadata: { source: 'test', timestamp: Date.now(), tags: [], type: 'note', importance: 0.5 } }));

        const results = await store.search(embedding, { filter: { type: 'fact' } });
        expect(results.length).toBe(1);
        expect(results[0].entry.metadata.type).toBe('fact');
    });
});
