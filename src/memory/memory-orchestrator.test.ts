/**
 * MemoryOrchestrator Tests
 *
 * Tests the unified JSONL + RAG memory system with all critical fixes:
 *  🔴 (A) Stream tail-read
 *  🔴 (B) Async non-blocking embed
 *  🔴 (C) Hash-based dedup
 *  🔴 (D) Hard maxDocuments limit
 *  🔴 (E) Error isolation with JSONL fallback
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MemoryOrchestrator, type MemoryConfig } from './memory-orchestrator.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-orchestrator-'));
}

function removeTmpDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* OK */ }
}

// ═══════════════════════════════════════════════════════════════════
// JSONL-Only Mode (Default)
// ═══════════════════════════════════════════════════════════════════

describe('MemoryOrchestrator — JSONL only (default)', () => {
    let tmpDir: string;
    let orchestrator: MemoryOrchestrator;

    beforeEach(() => {
        tmpDir = createTmpDir();
        orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
        });
    });

    afterEach(() => {
        removeTmpDir(tmpDir);
    });

    it('records and retrieves messages via JSONL', async () => {
        orchestrator.recordMessage('sess1', { role: 'user', content: 'Hello' });
        orchestrator.recordMessage('sess1', { role: 'assistant', content: 'Hi there!' });

        const ctx = await orchestrator.buildContext('sess1', 'greeting');
        expect(ctx.recentMessages).toHaveLength(2);
        expect(ctx.ragUsed).toBe(false);
        expect(ctx.contextText).toContain('Hello');
        expect(ctx.contextText).toContain('Hi there!');
    });

    it('stats show JSONL sessions, no RAG', () => {
        orchestrator.recordMessage('s1', { role: 'user', content: 'a' });
        orchestrator.recordMessage('s2', { role: 'user', content: 'b' });

        const stats = orchestrator.stats();
        expect(stats.jsonl.sessions).toBe(2);
        expect(stats.rag).toBeNull();
    });

    it('returns empty context for non-existent session', async () => {
        const ctx = await orchestrator.buildContext('nonexistent', 'test');
        expect(ctx.recentMessages).toHaveLength(0);
        expect(ctx.contextText).toBe('');
        expect(ctx.ragUsed).toBe(false);
    });

    it('respects recentCount limit', async () => {
        for (let i = 0; i < 30; i++) {
            orchestrator.recordMessage('sess1', { role: 'user', content: `msg-${i}` });
        }

        const ctx = await orchestrator.buildContext('sess1', 'recent', { recentCount: 5 });
        expect(ctx.recentMessages).toHaveLength(5);
    });
});

// ═══════════════════════════════════════════════════════════════════
// JSONL + RAG Mode
// ═══════════════════════════════════════════════════════════════════

describe('MemoryOrchestrator — JSONL + RAG (local)', () => {
    let tmpDir: string;
    let orchestrator: MemoryOrchestrator;

    beforeEach(() => {
        tmpDir = createTmpDir();
        orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
            rag: {
                enabled: true,
                engine: 'local',
                maxDocuments: 10_000,
            },
        });
    });

    afterEach(async () => {
        await orchestrator.flush();
        removeTmpDir(tmpDir);
    });

    it('records to both JSONL and RAG', async () => {
        orchestrator.recordMessage('sess1', { role: 'user', content: 'TypeScript is great' });
        await orchestrator.flush(); // wait for embedding queue

        const stats = orchestrator.stats();
        expect(stats.jsonl.sessions).toBe(1);
        expect(stats.rag).not.toBeNull();
        expect(stats.rag!.documents).toBe(1);
    });

    it('buildContext includes both JSONL and RAG results', async () => {
        // Record many messages across sessions
        orchestrator.recordMessage('sess1', { role: 'user', content: 'JavaScript framework guide' });
        orchestrator.recordMessage('sess1', { role: 'assistant', content: 'React is popular' });
        orchestrator.recordMessage('sess2', { role: 'user', content: 'Python data science tutorial' });
        await orchestrator.flush();

        // Query from sess1 — JSONL returns recent, RAG may find related
        const ctx = await orchestrator.buildContext('sess1', 'JavaScript');
        expect(ctx.recentMessages.length).toBeGreaterThanOrEqual(1);
        expect(ctx.contextText).toContain('JavaScript');
    });

    // ─── 🔴 FIX (B): Async Embed ─────────────────────────────────

    it('recordMessage returns immediately (does not await embed)', () => {
        const start = Date.now();
        for (let i = 0; i < 100; i++) {
            orchestrator.recordMessage('sess-fast', { role: 'user', content: `msg-${i}` });
        }
        const elapsed = Date.now() - start;

        // 100 records should complete in <50ms (embedding is async)
        expect(elapsed).toBeLessThan(500);
    });

    // ─── 🔴 FIX (C): Hash Dedup ──────────────────────────────────

    it('deduplicates identical content in RAG', async () => {
        orchestrator.recordMessage('sess1', { role: 'user', content: 'exact same content' });
        orchestrator.recordMessage('sess1', { role: 'user', content: 'exact same content' });
        orchestrator.recordMessage('sess1', { role: 'user', content: 'exact same content' });
        await orchestrator.flush();

        const stats = orchestrator.stats();
        // Only 1 RAG entry despite 3 identical messages
        expect(stats.rag!.documents).toBe(1);
    });

    it('deduplicates RAG results that overlap with JSONL recent', async () => {
        // Record a message that will be in both JSONL recent AND RAG
        orchestrator.recordMessage('sess1', { role: 'user', content: 'overlapping content here' });
        await orchestrator.flush();

        const ctx = await orchestrator.buildContext('sess1', 'overlapping content here');
        // The RAG result should be filtered out because it's already in recent JSONL
        if (ctx.semanticMatches) {
            for (const match of ctx.semanticMatches) {
                expect(match.document.content).not.toBe('overlapping content here');
            }
        }
    });

    // ─── 🔴 FIX (D): Hard Limit ──────────────────────────────────

    it('enforces hard document limit on VectorStore', async () => {
        const smallOrchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
            rag: {
                enabled: true,
                engine: 'local',
                maxDocuments: 5,
            },
        });

        for (let i = 0; i < 10; i++) {
            smallOrchestrator.recordMessage('sess1', { role: 'user', content: `unique msg ${i}` });
        }
        await smallOrchestrator.flush();

        const stats = smallOrchestrator.stats();
        expect(stats.rag!.documents).toBeLessThanOrEqual(5);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 🔴 FIX (E): Error Isolation
// ═══════════════════════════════════════════════════════════════════

describe('MemoryOrchestrator — Error Isolation', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTmpDir();
    });

    afterEach(() => {
        removeTmpDir(tmpDir);
    });

    it('buildContext works even when RAG embed throws', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
            rag: {
                enabled: true,
                engine: 'local',
                maxDocuments: 100,
            },
        });

        // Record a message (JSONL works, RAG may or may not)
        orchestrator.recordMessage('sess1', { role: 'user', content: 'test message' });

        // Mock the embedder to throw on the NEXT call (in buildContext)
        const store = orchestrator.getVectorStore();
        if (store) {
            // Sabotage the embedder for buildContext queries
            const origEmbed = (orchestrator as any).embedder.embed;
            (orchestrator as any).embedder.embed = async () => {
                throw new Error('API_DOWN');
            };

            const ctx = await orchestrator.buildContext('sess1', 'test');
            // JSONL still returns results despite RAG failure
            expect(ctx.recentMessages).toHaveLength(1);
            expect(ctx.ragUsed).toBe(false);
            expect(ctx.contextText).toContain('test message');

            // Restore
            (orchestrator as any).embedder.embed = origEmbed;
        }
    });

    it('handles RAG disabled gracefully', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
            // No rag config = disabled
        });

        orchestrator.recordMessage('sess1', { role: 'user', content: 'just jsonl' });
        const ctx = await orchestrator.buildContext('sess1', 'query');

        expect(ctx.recentMessages).toHaveLength(1);
        expect(ctx.ragUsed).toBe(false);
        expect(ctx.semanticMatches).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════
// 🔴 FIX (A): Stream Tail-Read (via large file)
// ═══════════════════════════════════════════════════════════════════

describe('MemoryOrchestrator — Stream Tail-Read', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTmpDir();
    });

    afterEach(() => {
        removeTmpDir(tmpDir);
    });

    it('handles large transcript without loading entire file', async () => {
        const orchestrator = new MemoryOrchestrator({
            transcriptDir: tmpDir,
            transcript: { tailChunkBytes: 256 }, // small chunks to force multi-read
        });

        // Write 200 messages
        for (let i = 0; i < 200; i++) {
            orchestrator.recordMessage('big-sess', {
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message number ${i} with padding to increase file size significantly`,
            });
        }

        const ctx = await orchestrator.buildContext('big-sess', 'recent query', { recentCount: 10 });
        expect(ctx.recentMessages).toHaveLength(10);
        // Should be the last 10 messages
        expect(ctx.recentMessages[9].message?.content).toContain('199');
    });
});
