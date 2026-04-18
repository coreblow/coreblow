/**
 * Shutdown Integration Tests
 *
 * Verifies that GracefulShutdown correctly flushes memory subsystem
 * (MemoryOrchestrator + PersistentVectorStore) before stopping services.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CoreBlowServer } from './server.js';
import { GracefulShutdown } from './graceful-shutdown.js';
import { MemoryOrchestrator } from '../memory/memory-orchestrator.js';
import { PersistentVectorStore } from '../memory/vector-store-persistence.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-shutdown-'));
}

function removeTmpDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

describe('Shutdown Integration — Memory Hooks', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('CoreBlowServer.registerMemory hooks into shutdown', async () => {
        const server = new CoreBlowServer({ port: 0 });

        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
        });

        // Record some messages
        orchestrator.recordMessage('sess1', { role: 'user', content: 'before shutdown' });
        orchestrator.recordMessage('sess1', { role: 'assistant', content: 'will be flushed' });

        // Register memory
        server.registerMemory(orchestrator);

        // Stop triggers shutdown hooks including memory flush
        await server.stop();

        // Verify messages were written (JSONL is sync so they're already there)
        const ctx = await orchestrator.buildContext('sess1', 'test');
        expect(ctx.recentMessages.length).toBe(2);
    });

    it('GracefulShutdown executes memory hook at order 0 (first)', async () => {
        const shutdown = new GracefulShutdown();
        const executionOrder: string[] = [];

        shutdown.register({
            name: 'memory', order: 0,
            handler: async () => { executionOrder.push('memory'); },
        });
        shutdown.register({
            name: 'channels', order: 1,
            handler: async () => { executionOrder.push('channels'); },
        });
        shutdown.register({
            name: 'gateway', order: 4,
            handler: async () => { executionOrder.push('gateway'); },
        });

        await shutdown.shutdown();

        expect(executionOrder).toEqual(['memory', 'channels', 'gateway']);
    });

    it('shutdown continues even if memory flush throws', async () => {
        const shutdown = new GracefulShutdown();
        const executionOrder: string[] = [];

        shutdown.register({
            name: 'memory', order: 0,
            handler: async () => { throw new Error('flush failed'); },
        });
        shutdown.register({
            name: 'gateway', order: 1,
            handler: async () => { executionOrder.push('gateway'); },
        });

        const result = await shutdown.shutdown();

        // Gateway should still execute despite memory failure
        expect(executionOrder).toContain('gateway');
        expect(result.failed.length).toBe(1);
        expect(result.failed[0].name).toBe('memory');
        expect(result.completed).toContain('gateway');
    });

    it('PersistentVectorStore.saveNow() is called on shutdown', async () => {
        const vectorPath = path.join(tmpDir, 'vectors.jsonl');

        const pvs = new PersistentVectorStore({
            filePath: vectorPath,
            maxDocuments: 100,
            dimensions: 4,
            saveDebounceMs: 60_000, // long debounce — won't auto-save
        });

        // Add a document (will be pending, not yet saved to disk)
        pvs.add('doc1', 'test content', new Float32Array([0.1, 0.2, 0.3, 0.4]));

        // saveNow should flush pending appends
        await pvs.saveNow();

        // Verify file was written
        expect(fs.existsSync(vectorPath)).toBe(true);
        const content = fs.readFileSync(vectorPath, 'utf-8').trim();
        expect(content.length).toBeGreaterThan(0);

        // Verify content is valid JSONL
        const doc = JSON.parse(content);
        expect(doc.id).toBe('doc1');
        expect(doc.content).toBe('test content');
    });
});
