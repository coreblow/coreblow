/**
 * TranscriptStore Tests
 *
 * Validates JSONL session memory: append, stream tail-read,
 * compaction, corruption handling, edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TranscriptStore, type TranscriptEntry } from './transcript-store.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-transcript-'));
}

function removeTmpDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* OK */ }
}

function makeMsg(role: 'user' | 'assistant', content: string, ts?: number): TranscriptEntry {
    return {
        type: 'message',
        timestamp: ts ?? Date.now(),
        message: { role, content },
    };
}

describe('TranscriptStore', () => {
    let tmpDir: string;
    let store: TranscriptStore;

    beforeEach(() => {
        tmpDir = createTmpDir();
        store = new TranscriptStore({ storeDir: tmpDir });
    });

    afterEach(() => {
        removeTmpDir(tmpDir);
    });

    // ═══════════════════════════════════════════════════════════
    // Basic CRUD
    // ═══════════════════════════════════════════════════════════

    it('creates store directory if not exists', () => {
        const dir = path.join(tmpDir, 'sub', 'deep');
        new TranscriptStore({ storeDir: dir });
        expect(fs.existsSync(dir)).toBe(true);
    });

    it('appends and retrieves a single message', async () => {
        const msg = makeMsg('user', 'hello world');
        store.appendMessage('sess1', msg);
        const recent = await store.getRecentMessages('sess1');
        expect(recent).toHaveLength(1);
        expect(recent[0].message?.content).toBe('hello world');
        expect(recent[0].message?.role).toBe('user');
    });

    it('retrieves messages in chronological order', async () => {
        store.appendMessage('sess1', makeMsg('user', 'first', 1000));
        store.appendMessage('sess1', makeMsg('assistant', 'second', 2000));
        store.appendMessage('sess1', makeMsg('user', 'third', 3000));

        const recent = await store.getRecentMessages('sess1');
        expect(recent).toHaveLength(3);
        expect(recent[0].message?.content).toBe('first');
        expect(recent[1].message?.content).toBe('second');
        expect(recent[2].message?.content).toBe('third');
    });

    it('respects count limit', async () => {
        for (let i = 0; i < 10; i++) {
            store.appendMessage('sess1', makeMsg('user', `msg-${i}`, i * 1000));
        }
        const recent = await store.getRecentMessages('sess1', 3);
        expect(recent).toHaveLength(3);
        // Should be the LAST 3 messages
        expect(recent[0].message?.content).toBe('msg-7');
        expect(recent[1].message?.content).toBe('msg-8');
        expect(recent[2].message?.content).toBe('msg-9');
    });

    it('returns empty for non-existent session', async () => {
        const recent = await store.getRecentMessages('nonexistent');
        expect(recent).toHaveLength(0);
    });

    // ═══════════════════════════════════════════════════════════
    // Stream Tail-Read (🔴 FIX A)
    // ═══════════════════════════════════════════════════════════

    it('handles large file via stream tail-read', async () => {
        // Write 500 messages (would be >50KB)
        for (let i = 0; i < 500; i++) {
            store.appendMessage('sess-big', makeMsg('user', `message number ${i} with some padding text to increase size`, i * 1000));
        }

        const fileSize = store.getSessionFileSize('sess-big');
        expect(fileSize).toBeGreaterThan(50_000); // >50KB

        // Should read last 20 without loading entire file
        const recent = await store.getRecentMessages('sess-big', 20);
        expect(recent).toHaveLength(20);
        expect(recent[19].message?.content).toContain('499');
    });

    it('handles small tail-chunk reads across multiple chunks', async () => {
        const smallStore = new TranscriptStore({
            storeDir: tmpDir,
            tailChunkBytes: 128, // Very small chunks to force multi-read
        });

        for (let i = 0; i < 20; i++) {
            smallStore.appendMessage('sess-small', makeMsg('user', `msg-${i}`, i * 1000));
        }

        const recent = await smallStore.getRecentMessages('sess-small', 10);
        expect(recent).toHaveLength(10);
        expect(recent[9].message?.content).toBe('msg-19');
    });

    // ═══════════════════════════════════════════════════════════
    // Corruption Handling
    // ═══════════════════════════════════════════════════════════

    it('skips corrupted JSON lines gracefully', async () => {
        const filePath = store.getSessionFilePath('corrupt');
        fs.writeFileSync(filePath, [
            JSON.stringify(makeMsg('user', 'good1')),
            '{"broken json that is not valid',
            JSON.stringify(makeMsg('user', 'good2')),
            '',
        ].join('\n'));

        const recent = await store.getRecentMessages('corrupt');
        expect(recent).toHaveLength(2);
        expect(recent[0].message?.content).toBe('good1');
        expect(recent[1].message?.content).toBe('good2');
    });

    // ═══════════════════════════════════════════════════════════
    // Compaction
    // ═══════════════════════════════════════════════════════════

    it('detects when compaction is needed', () => {
        const smallStore = new TranscriptStore({
            storeDir: tmpDir,
            maxFileSizeBytes: 200,
        });

        smallStore.appendMessage('sess-compact', makeMsg('user', 'short'));
        expect(smallStore.shouldCompact('sess-compact')).toBe(false);

        // Write enough to exceed 200 bytes
        for (let i = 0; i < 10; i++) {
            smallStore.appendMessage('sess-compact', makeMsg('user', `long message ${i} with extra padding`));
        }
        expect(smallStore.shouldCompact('sess-compact')).toBe(true);
    });

    it('compacts a session transcript', async () => {
        const smallStore = new TranscriptStore({
            storeDir: tmpDir,
            maxFileSizeBytes: 200,
            defaultRetrievalCount: 3,
        });

        for (let i = 0; i < 20; i++) {
            smallStore.appendMessage('sess-c', makeMsg('user', `message ${i}`));
        }

        const result = await smallStore.compact('sess-c');
        expect(result.after).toBeLessThan(result.before);

        // Should still have the most recent messages
        const recent = await smallStore.getRecentMessages('sess-c', 6);
        // Compacted keeps 2x defaultRetrievalCount = 6
        expect(recent.length).toBeLessThanOrEqual(6);
    });

    // ═══════════════════════════════════════════════════════════
    // Session Management
    // ═══════════════════════════════════════════════════════════

    it('lists sessions', () => {
        store.appendMessage('sess-a', makeMsg('user', 'a'));
        store.appendMessage('sess-b', makeMsg('user', 'b'));

        const sessions = store.listSessions();
        expect(sessions).toContain('sess-a');
        expect(sessions).toContain('sess-b');
    });

    it('deletes a session', () => {
        store.appendMessage('sess-del', makeMsg('user', 'to delete'));
        expect(store.deleteSession('sess-del')).toBe(true);
        expect(store.deleteSession('sess-del')).toBe(false); // already gone
    });

    it('returns 0 size for non-existent session', () => {
        expect(store.getSessionFileSize('nope')).toBe(0);
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    it('handles empty file', async () => {
        const filePath = store.getSessionFilePath('empty');
        fs.writeFileSync(filePath, '');
        const recent = await store.getRecentMessages('empty');
        expect(recent).toHaveLength(0);
    });

    it('handles file with only newlines', async () => {
        const filePath = store.getSessionFilePath('newlines');
        fs.writeFileSync(filePath, '\n\n\n');
        const recent = await store.getRecentMessages('newlines');
        expect(recent).toHaveLength(0);
    });

    it('sanitizes session IDs with special characters', () => {
        const filePath = store.getSessionFilePath('../../etc/passwd');
        expect(filePath).not.toContain('..');
        expect(path.dirname(filePath)).toBe(tmpDir);
    });

    it('handles system entries (not returned as messages)', async () => {
        store.appendMessage('sess-sys', { type: 'system', timestamp: Date.now() });
        store.appendMessage('sess-sys', makeMsg('user', 'real message'));
        const recent = await store.getRecentMessages('sess-sys');
        expect(recent).toHaveLength(1);
        expect(recent[0].message?.content).toBe('real message');
    });
});
