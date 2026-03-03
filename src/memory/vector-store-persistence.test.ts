import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { VectorStore } from './vector-store.js';
import { VectorStorePersistence, PersistentVectorStore } from './vector-store-persistence.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-persist-'));
}

function removeTmpDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* OK */ }
}

function makeEmb(seed: number, dims = 8): Float32Array {
    const arr = new Float32Array(dims);
    for (let i = 0; i < dims; i++) arr[i] = Math.sin(seed * (i + 1));
    return arr;
}

// ═══════════════════════════════════════════════════════════════════
// VectorStorePersistence (static methods)
// ═══════════════════════════════════════════════════════════════════

describe('VectorStorePersistence', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('saves and loads documents via JSONL', () => {
        const store = new VectorStore({ dimensions: 8, maxDocuments: 100 });
        store.add('d1', 'hello world', makeEmb(1), { author: 'test' });
        store.add('d2', 'foo bar', makeEmb(2), undefined, 'ns1');

        const filePath = path.join(tmpDir, 'store.jsonl');

        // Get all documents
        const results = store.search(makeEmb(0), { topK: 100, minScore: -Infinity });
        const docs = results.map(r => r.document);
        VectorStorePersistence.saveDocuments(docs, filePath);

        // Load into new store
        const loaded = VectorStorePersistence.load(filePath, { dimensions: 8 });
        expect(loaded.count()).toBe(2);
        expect(loaded.get('d1')?.content).toBe('hello world');
        expect(loaded.get('d1')?.metadata).toEqual({ author: 'test' });
        expect(loaded.get('d2')?.namespace).toBe('ns1');
    });

    it('handles empty file', () => {
        const filePath = path.join(tmpDir, 'empty.jsonl');
        fs.writeFileSync(filePath, '');
        const store = VectorStorePersistence.load(filePath);
        expect(store.count()).toBe(0);
    });

    it('handles non-existent file', () => {
        const store = VectorStorePersistence.load(path.join(tmpDir, 'nope.jsonl'));
        expect(store.count()).toBe(0);
    });

    it('skips corrupted lines', () => {
        const filePath = path.join(tmpDir, 'corrupt.jsonl');
        const goodLine = JSON.stringify({
            id: 'd1', content: 'good', embedding: [1, 2, 3],
            createdAt: Date.now(),
        });
        fs.writeFileSync(filePath, `${goodLine}\n{broken json}\n`);

        const store = VectorStorePersistence.load(filePath);
        expect(store.count()).toBe(1);
    });

    it('appends a document incrementally', () => {
        const filePath = path.join(tmpDir, 'append.jsonl');

        const store = new VectorStore({ dimensions: 8 });
        const doc = store.add('d1', 'first', makeEmb(1));
        VectorStorePersistence.appendDocument(filePath, doc);

        const doc2 = store.add('d2', 'second', makeEmb(2));
        VectorStorePersistence.appendDocument(filePath, doc2);

        // Load and verify both exist
        const loaded = VectorStorePersistence.load(filePath, { dimensions: 8 });
        expect(loaded.count()).toBe(2);
        expect(loaded.get('d1')?.content).toBe('first');
        expect(loaded.get('d2')?.content).toBe('second');
    });

    it('reports file size', () => {
        const filePath = path.join(tmpDir, 'size.jsonl');
        expect(VectorStorePersistence.getFileSize(filePath)).toBe(0);

        fs.writeFileSync(filePath, 'test content');
        expect(VectorStorePersistence.getFileSize(filePath)).toBeGreaterThan(0);
    });

    it('creates directories when saving', () => {
        const filePath = path.join(tmpDir, 'deep', 'nested', 'store.jsonl');
        const store = new VectorStore({ dimensions: 8 });
        const doc = store.add('d1', 'test', makeEmb(1));
        VectorStorePersistence.appendDocument(filePath, doc);
        expect(fs.existsSync(filePath)).toBe(true);
    });

    it('preserves Float32Array precision through save/load cycle', () => {
        const store = new VectorStore({ dimensions: 8, maxDocuments: 100 });
        const emb = makeEmb(42);
        store.add('precise', 'test', emb);

        const filePath = path.join(tmpDir, 'precise.jsonl');
        const results = store.search(emb, { topK: 1 });
        VectorStorePersistence.saveDocuments(results.map(r => r.document), filePath);

        const loaded = VectorStorePersistence.load(filePath, { dimensions: 8 });
        const loadedDoc = loaded.get('precise');
        expect(loadedDoc).not.toBeNull();
        // Float32 precision: compare with tolerance
        for (let i = 0; i < emb.length; i++) {
            expect(loadedDoc!.embedding[i]).toBeCloseTo(emb[i]!, 5);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// PersistentVectorStore
// ═══════════════════════════════════════════════════════════════════

describe('PersistentVectorStore', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('loads existing data on construction', () => {
        const filePath = path.join(tmpDir, 'persist.jsonl');

        // Pre-populate
        const store = new VectorStore({ dimensions: 8 });
        const doc = store.add('d1', 'existing', makeEmb(1));
        VectorStorePersistence.appendDocument(filePath, doc);

        // Create PersistentVectorStore — should load existing
        const persistent = new PersistentVectorStore({
            filePath,
            dimensions: 8,
        });
        expect(persistent.count()).toBe(1);
        expect(persistent.get('d1')?.content).toBe('existing');
    });

    it('adds and searches documents', () => {
        const filePath = path.join(tmpDir, 'add.jsonl');
        const persistent = new PersistentVectorStore({ filePath, dimensions: 8 });

        persistent.add('d1', 'hello', makeEmb(1));
        persistent.add('d2', 'world', makeEmb(2));

        const results = persistent.search(makeEmb(1), { topK: 1 });
        expect(results).toHaveLength(1);
        expect(results[0].document.id).toBe('d1');
    });

    it('persists appends to disk via saveNow', async () => {
        const filePath = path.join(tmpDir, 'flush.jsonl');
        const persistent = new PersistentVectorStore({
            filePath,
            dimensions: 8,
            saveDebounceMs: 60_000, // long debounce — we'll force save
        });

        persistent.add('d1', 'save me', makeEmb(1));
        await persistent.saveNow();

        // Verify file has data
        expect(VectorStorePersistence.getFileSize(filePath)).toBeGreaterThan(0);

        // Load in new instance
        const loaded = new PersistentVectorStore({ filePath, dimensions: 8 });
        expect(loaded.count()).toBe(1);
        expect(loaded.get('d1')?.content).toBe('save me');
    });

    it('deletes documents', () => {
        const filePath = path.join(tmpDir, 'del.jsonl');
        const persistent = new PersistentVectorStore({ filePath, dimensions: 8 });

        persistent.add('d1', 'a', makeEmb(1));
        persistent.add('d2', 'b', makeEmb(2));
        expect(persistent.delete('d1')).toBe(true);
        expect(persistent.count()).toBe(1);
    });
});
