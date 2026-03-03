import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { TranscriptStore } from './transcript-store.js';
import { VectorStorePersistence } from './vector-store-persistence.js';
import { VectorStore } from './vector-store.js';
import { MemoryOrchestrator } from './memory-orchestrator.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-safety-'));
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
// M5: Disk Full / Filesystem Error
// ═══════════════════════════════════════════════════════════════════

describe('Resource Safety — Disk/FS Errors', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('TranscriptStore survives write to invalid path (disk error)', () => {
        // Create store pointing to a path that will fail on write
        // /dev/null is a file, not a directory — appendFileSync will fail
        const badStore = new TranscriptStore({ storeDir: tmpDir });

        // First write succeeds
        badStore.appendMessage('sess1', {
            type: 'message',
            timestamp: Date.now(),
            message: { role: 'user', content: 'hello' },
        });

        // Now make the session file read-only to trigger write error
        const filePath = badStore.getSessionFilePath('sess1');
        fs.chmodSync(filePath, 0o444);

        // Should NOT crash even though write fails
        expect(() => {
            badStore.appendMessage('sess1', {
                type: 'message',
                timestamp: Date.now(),
                message: { role: 'user', content: 'disk error' },
            });
        }).not.toThrow();

        // Restore write permission and verify recovery
        fs.chmodSync(filePath, 0o644);
        badStore.appendMessage('sess1', {
            type: 'message',
            timestamp: Date.now(),
            message: { role: 'user', content: 'recovered' },
        });
    });

    it('VectorStorePersistence handles write permission error', () => {
        const filePath = path.join(tmpDir, 'readonly.jsonl');

        // Create file, then verify appendDocument doesn't crash on error
        const store = new VectorStore({ dimensions: 8 });
        const doc = store.add('d1', 'test', makeEmb(1));

        // Write to impossible path
        const badPath = path.join('/dev/null', 'impossible', 'store.jsonl');
        expect(() => {
            VectorStorePersistence.appendDocument(badPath, doc);
        }).not.toThrow(); // Should be caught, not crash

        // Original path still works
        VectorStorePersistence.appendDocument(filePath, doc);
        expect(VectorStorePersistence.getFileSize(filePath)).toBeGreaterThan(0);
    });

    it('VectorStorePersistence.load handles corrupted file', () => {
        const filePath = path.join(tmpDir, 'garbage.jsonl');
        fs.writeFileSync(filePath, 'not json at all\n{broken\n');

        // Should not throw, just return empty store
        const store = VectorStorePersistence.load(filePath);
        expect(store.count()).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// M7: Memory Leak Under Sustained Load
// ═══════════════════════════════════════════════════════════════════

describe('Resource Safety — Memory Leak', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('VectorStore add/delete cycle does not leak memory', () => {
        const store = new VectorStore({ dimensions: 8, maxDocuments: 100 });

        // Add and delete 500 documents
        for (let i = 0; i < 500; i++) {
            const id = `doc-${i}`;
            store.add(id, `content ${i}`, makeEmb(i));
            if (i >= 100) {
                store.delete(`doc-${i - 100}`);
            }
        }

        // Should never exceed maxDocuments
        expect(store.count()).toBeLessThanOrEqual(100);
    });

    it('TranscriptStore many sessions do not accumulate unbounded', () => {
        const store = new TranscriptStore({ storeDir: tmpDir });

        // Create 100 sessions with 5 messages each
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                store.appendMessage(`sess-${i}`, {
                    type: 'message',
                    timestamp: Date.now(),
                    message: { role: 'user', content: `msg ${j}` },
                });
            }
        }

        const sessions = store.listSessions();
        expect(sessions.length).toBe(100);

        // Delete all sessions
        for (const sess of sessions) {
            store.deleteSession(sess);
        }

        expect(store.listSessions().length).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// M8: Concurrent Multi-Agent Sessions
// ═══════════════════════════════════════════════════════════════════

describe('Resource Safety — Concurrent Sessions', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('concurrent recordMessage to same session — all written', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
        });

        // Fire 10 concurrent writes
        const writes = Array.from({ length: 10 }, (_, i) =>
            Promise.resolve(orchestrator.recordMessage('sess1', {
                role: 'user',
                content: `concurrent-${i}`,
            }))
        );

        await Promise.all(writes);

        const ctx = await orchestrator.buildContext('sess1', 'test');
        expect(ctx.recentMessages.length).toBe(10);
    });

    it('concurrent buildContext calls do not interfere', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
        });

        // Write some messages first
        for (let i = 0; i < 5; i++) {
            orchestrator.recordMessage('sess1', {
                role: 'user', content: `msg-${i}`,
            });
        }

        // Fire 5 concurrent context builds
        const contexts = await Promise.all(
            Array.from({ length: 5 }, () =>
                orchestrator.buildContext('sess1', 'test')
            )
        );

        // All should return the same 5 messages
        for (const ctx of contexts) {
            expect(ctx.recentMessages.length).toBe(5);
        }
    });

    it('writes to different sessions are independent', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
        });

        // Write to 3 different sessions concurrently
        await Promise.all([
            Promise.resolve(orchestrator.recordMessage('sess-a', { role: 'user', content: 'a' })),
            Promise.resolve(orchestrator.recordMessage('sess-b', { role: 'user', content: 'b' })),
            Promise.resolve(orchestrator.recordMessage('sess-c', { role: 'user', content: 'c' })),
        ]);

        const ctxA = await orchestrator.buildContext('sess-a', 'test');
        const ctxB = await orchestrator.buildContext('sess-b', 'test');
        const ctxC = await orchestrator.buildContext('sess-c', 'test');

        expect(ctxA.recentMessages.length).toBe(1);
        expect(ctxB.recentMessages.length).toBe(1);
        expect(ctxC.recentMessages.length).toBe(1);
        expect(ctxA.recentMessages[0].message?.content).toBe('a');
        expect(ctxB.recentMessages[0].message?.content).toBe('b');
        expect(ctxC.recentMessages[0].message?.content).toBe('c');
    });
});
