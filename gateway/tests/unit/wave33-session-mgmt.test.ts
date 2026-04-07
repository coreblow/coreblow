/**
 * Wave 33: Session Management (persistence, locks, export, fork)
 * TARGET: ~40 tests
 *
 * OpenClaw ref: session/persistence.ts + session/write-lock.ts + conversation/branch-manager.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionPersistenceManager } from '../../src/agents/session-persistence.js';
import { SessionWriteLockManager } from '../../src/agents/session-write-lock.js';
import { ConversationExporter, type ExportMessage } from '../../src/agents/conversation-exporter.js';
import { ForkManager } from '../../src/agents/fork.js';

// ─── SessionPersistenceManager ────────────────────────────────────────────

describe('SessionPersistenceManager', () => {
    let manager: SessionPersistenceManager;

    beforeEach(() => {
        vi.useFakeTimers();
        manager = new SessionPersistenceManager({
            defaultTtlMs: 0, maxSessions: 100,
            cleanupIntervalMs: 99999, archiveOnExpiry: false
        });
    });

    afterEach(() => { manager.stopCleanup(); vi.useRealTimers(); });

    it('getOrCreate creates a new session', () => {
        const meta = manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        expect(meta.id).toBe('s1');
    });

    it('getMetadata retrieves existing session', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        expect(manager.getMetadata('s1')).toBeDefined();
    });

    it('appendMessage stores messages', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.appendMessage('s1', { role: 'user', content: 'hello' });
        expect(manager.getMessages('s1')).toHaveLength(1);
    });

    it('list returns all sessions', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c1', userId: 'u', tags: [], metadata: {} });
        manager.getOrCreate('s2', { agentId: 'a', channel: 'c2', userId: 'u', tags: [], metadata: {} });
        expect(manager.list()).toHaveLength(2);
    });

    it('list filters by channel', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'slack', userId: 'u', tags: [], metadata: {} });
        manager.getOrCreate('s2', { agentId: 'a', channel: 'discord', userId: 'u', tags: [], metadata: {} });
        expect(manager.list({ channel: 'slack' })).toHaveLength(1);
    });

    it('delete removes session', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.delete('s1');
        expect(manager.getMetadata('s1')).toBeUndefined();
    });

    it('setTtl updates expiry', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        expect(manager.setTtl('s1', 1000)).toBe(true);
    });

    it('cleanup marks expired sessions', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.setTtl('s1', 500);
        vi.advanceTimersByTime(1000);
        const result = manager.cleanup();
        expect(result.expired).toBeGreaterThan(0);
    });

    it('isExpired returns true for expired sessions', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.setTtl('s1', 100);
        vi.advanceTimersByTime(500);
        expect(manager.isExpired('s1')).toBe(true);
    });

    it('addTag attaches tag to session', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.addTag('s1', 'vip');
        expect(manager.getMetadata('s1')?.tags).toContain('vip');
    });

    it('archive soft-deletes session', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.archive('s1');
        expect(manager.getMetadata('s1')?.archived).toBe(true);
    });

    it('export + import roundtrip', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        manager.appendMessage('s1', { role: 'user', content: 'hi' });
        const exported = manager.export('s1')!;
        const mgr2 = new SessionPersistenceManager();
        mgr2.import(exported);
        mgr2.stopCleanup();
        expect(mgr2.getMessages('s1')).toHaveLength(1);
    });

    it('getStats returns totals', () => {
        manager.getOrCreate('s1', { agentId: 'a', channel: 'c', userId: 'u', tags: [], metadata: {} });
        const stats = manager.getStats();
        expect(stats.total).toBe(1);
    });
});

// ─── SessionWriteLockManager ──────────────────────────────────────────────

describe('SessionWriteLockManager', () => {
    let lockMgr: SessionWriteLockManager;

    beforeEach(() => { lockMgr = new SessionWriteLockManager(10000); });
    afterEach(() => { lockMgr.shutdown(); });

    it('acquires a lock successfully', async () => {
        const r = await lockMgr.acquire('s1', { holder: 'A' });
        expect(r.acquired).toBe(true);
        lockMgr.release('s1', 'A');
    });

    it('prevents acquisition by different holder', async () => {
        await lockMgr.acquire('s1', { holder: 'A' });
        const r = await lockMgr.acquire('s1', { holder: 'B' });
        expect(r.acquired).toBe(false);
        lockMgr.release('s1', 'A');
    });

    it('supports re-entrant locks for same holder', async () => {
        await lockMgr.acquire('s1', { holder: 'A', reentrant: true });
        const r2 = await lockMgr.acquire('s1', { holder: 'A', reentrant: true });
        expect(r2.acquired).toBe(true);
        lockMgr.release('s1', 'A');
        lockMgr.release('s1', 'A');
    });

    it('isLocked is true while held, false after release', async () => {
        expect(lockMgr.isLocked('s1')).toBe(false);
        await lockMgr.acquire('s1', { holder: 'A' });
        expect(lockMgr.isLocked('s1')).toBe(true);
        lockMgr.release('s1', 'A');
        expect(lockMgr.isLocked('s1')).toBe(false);
    });

    it('withLock executes fn and auto-releases', async () => {
        let ran = false;
        await lockMgr.withLock('s1', { holder: 'A' }, async () => { ran = true; });
        expect(ran).toBe(true);
        expect(lockMgr.isLocked('s1')).toBe(false);
    });

    it('withLock releases even on exception', async () => {
        await expect(lockMgr.withLock('s1', { holder: 'A' }, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
        expect(lockMgr.isLocked('s1')).toBe(false);
    });

    it('getStats tracks totalAcquired and totalReleased', async () => {
        await lockMgr.acquire('s1', { holder: 'A' });
        lockMgr.release('s1', 'A');
        const stats = lockMgr.getStats();
        expect(stats.totalAcquired).toBeGreaterThan(0);
        expect(stats.totalReleased).toBeGreaterThan(0);
    });

    it('forceRelease removes any lock regardless of holder', async () => {
        await lockMgr.acquire('s1', { holder: 'A' });
        lockMgr.forceRelease('s1');
        expect(lockMgr.isLocked('s1')).toBe(false);
    });

    it('getLockInfo returns holder information', async () => {
        await lockMgr.acquire('s1', { holder: 'A' });
        const info = lockMgr.getLockInfo('s1');
        expect(info?.holder).toBe('A');
        lockMgr.release('s1', 'A');
    });
});

// ─── ConversationExporter ─────────────────────────────────────────────────

describe('ConversationExporter', () => {
    const makeMessages = (): ExportMessage[] => [
        { role: 'user', content: 'Hello there', timestamp: 1000 },
        { role: 'assistant', content: 'Hi! How can I help?', timestamp: 2000 },
        { role: 'user', content: 'Tell me about AI', timestamp: 3000 },
    ];

    let exporter: ConversationExporter;
    beforeEach(() => { exporter = new ConversationExporter(); });

    it('exports to JSON format', () => {
        const result = exporter.export(makeMessages(), { format: 'json', title: 'Test' });
        const parsed = JSON.parse(result.content);
        expect(parsed.title).toBe('Test');
        expect(parsed.messages).toHaveLength(3);
    });

    it('exports to Markdown format', () => {
        const result = exporter.export(makeMessages(), { format: 'markdown' });
        expect(result.content).toContain('# ');
        expect(result.content).toContain('Hello there');
    });

    it('exports to Text format', () => {
        const result = exporter.export(makeMessages(), { format: 'text' });
        expect(result.content).toContain('Hello there');
        expect(result.content).not.toContain('<html');
    });

    it('exports to HTML format', () => {
        const result = exporter.export(makeMessages(), { format: 'html' });
        expect(result.content).toContain('<html');
        expect(result.content).toContain('Hello there');
    });

    it('excludes system messages when includeSystem=false', () => {
        const msgs: ExportMessage[] = [
            { role: 'system', content: 'sys prompt', timestamp: 0 },
            { role: 'user', content: 'user msg', timestamp: 1 },
        ];
        const result = exporter.export(msgs, { format: 'json', includeSystem: false });
        const parsed = JSON.parse(result.content);
        expect(parsed.messages.some((m: any) => m.role === 'system')).toBe(false);
    });

    it('messageCount in result matches filtered messages', () => {
        const result = exporter.export(makeMessages(), { format: 'json' });
        expect(result.messageCount).toBe(3);
    });

    it('exports empty conversation gracefully', () => {
        const result = exporter.export([], { format: 'json' });
        const parsed = JSON.parse(result.content);
        expect(parsed.messages).toHaveLength(0);
    });
});

// ─── ForkManager ─────────────────────────────────────────────────────────

describe('ForkManager', () => {
    let forkMgr: ForkManager;
    beforeEach(() => { forkMgr = new ForkManager(); });

    it('initSession creates root (main) branch', () => {
        const rootId = forkMgr.initSession('s1');
        // getBranch isn't public; check via getActiveBranch or listBranches
        const branches = forkMgr.listBranches('s1');
        expect(branches.some(b => b.name === 'main')).toBe(true);
    });

    it('initSession is idempotent', () => {
        const r1 = forkMgr.initSession('s1');
        const r2 = forkMgr.initSession('s1');
        expect(r1).toBe(r2);
    });

    it('fork creates child branch with parentId', () => {
        const rootId = forkMgr.initSession('s1', [{ role: 'user', content: 'base' }]);
        const result = forkMgr.fork('s1', 'explore A');
        expect(result.parentId).toBe(rootId);
    });

    it('forked branch inherits messages from parent', () => {
        forkMgr.initSession('s1', [{ role: 'user', content: 'shared base' }]);
        const { branchId } = forkMgr.fork('s1', 'fork');
        const branch = forkMgr.listBranches('s1').find(b => b.id === branchId);
        expect(branch?.messages.some(m => m.content === 'shared base')).toBe(true);
    });

    it('appendMessage adds to branch', () => {
        const rootId = forkMgr.initSession('s1');
        forkMgr.appendMessage(rootId, { role: 'user', content: 'new msg' });       
        expect(forkMgr.getMessages(rootId).some(m => m.content === 'new msg')).toBe(true);
    });

    it('appendToActive adds to active branch', () => {
        forkMgr.initSession('s1');
        forkMgr.appendToActive('s1', { role: 'user', content: 'active msg' });
        expect(forkMgr.getActiveBranch('s1')?.messages.some(m => m.content === 'active msg')).toBe(true);
    });

    it('switchBranch changes the active branch', () => {
        forkMgr.initSession('s1');
        const { branchId } = forkMgr.fork('s1', 'alt');
        expect(forkMgr.switchBranch('s1', branchId)).toBe(true);
        expect(forkMgr.getActiveBranch('s1')?.id).toBe(branchId);
    });

    it('listBranches returns all session branches', () => {
        forkMgr.initSession('s1');
        forkMgr.fork('s1', 'A');
        forkMgr.fork('s1', 'B');
        expect(forkMgr.listBranches('s1').length).toBeGreaterThanOrEqual(3);
    });

    it('merge adds new messages from source into target', () => {
        forkMgr.initSession('s1', [{ role: 'user', content: 'root' }]);
        const { branchId: forkId } = forkMgr.fork('s1', 'fork');
        forkMgr.appendMessage(forkId, { role: 'assistant', content: 'fork answer' });
        const rootId = `s1_root`;
        const result = forkMgr.merge('s1', forkId, rootId);
        expect(result.addedMessages).toBeGreaterThan(0);
    });

    it('compare computes common ancestor count', () => {
        forkMgr.initSession('s1', [{ role: 'user', content: 'common' }]);
        const { branchId: id1 } = forkMgr.fork('s1', 'A');
        const { branchId: id2 } = forkMgr.fork('s1', 'B');
        const cmp = forkMgr.compare(id1, id2);
        expect(cmp.commonAncestorMessages).toBeGreaterThanOrEqual(1);
    });

    it('deleteBranch removes non-root branch', () => {
        forkMgr.initSession('s1');
        const { branchId } = forkMgr.fork('s1', 'temp');
        expect(forkMgr.deleteBranch(branchId)).toBe(true);
        const branches = forkMgr.listBranches('s1');
        expect(branches.some(b => b.id === branchId)).toBe(false);
    });
});
