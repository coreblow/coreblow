// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionPersistenceManager } from './session-persistence.js';

describe('Session Persistence — Phase 11', () => {
    let manager: SessionPersistenceManager;

    beforeEach(() => {
        manager = new SessionPersistenceManager({
            defaultTtlMs: 1000, // 1s for fast testing
            maxSessions: 5,
            archiveOnExpiry: true,
        });
    });

    it('creates a new session', () => {
        const meta = manager.getOrCreate('sess-1', { channel: 'discord', userId: 'alice' });
        expect(meta.id).toBe('sess-1');
        expect(meta.channel).toBe('discord');
        expect(meta.userId).toBe('alice');
        expect(meta.archived).toBe(false);
    });

    it('returns existing session on second call', () => {
        const m1 = manager.getOrCreate('sess-1');
        const m2 = manager.getOrCreate('sess-1');
        expect(m1.id).toBe(m2.id);
    });

    it('appends and retrieves messages', () => {
        manager.getOrCreate('sess-1');
        manager.appendMessage('sess-1', { role: 'user', content: 'Hello' });
        manager.appendMessage('sess-1', { role: 'assistant', content: 'Hi!' });
        const msgs = manager.getMessages('sess-1');
        expect(msgs).toHaveLength(2);
        expect(msgs[0].content).toBe('Hello');
    });

    it('updates messageCount on append', () => {
        manager.getOrCreate('sess-1');
        manager.appendMessage('sess-1', { role: 'user', content: 'test' });
        expect(manager.getMetadata('sess-1')!.messageCount).toBe(1);
    });

    it('ignores append for unknown session', () => {
        manager.appendMessage('nonexistent', { role: 'user', content: 'x' });
        expect(manager.getMessages('nonexistent')).toEqual([]);
    });

    it('isExpired detects expired session', () => {
        const meta = manager.getOrCreate('sess-1');
        meta.lastActiveAt = Date.now() - 5000; // 5s ago, TTL is 1s
        expect(manager.isExpired('sess-1')).toBe(true);
    });

    it('isExpired returns false for active session', () => {
        manager.getOrCreate('sess-1');
        expect(manager.isExpired('sess-1')).toBe(false);
    });

    it('isExpired returns false for no-TTL session', () => {
        manager.getOrCreate('sess-1');
        manager.setTtl('sess-1', 0);
        expect(manager.isExpired('sess-1')).toBe(false);
    });

    it('adds tags', () => {
        manager.getOrCreate('sess-1');
        manager.addTag('sess-1', 'important');
        manager.addTag('sess-1', 'vip');
        manager.addTag('sess-1', 'important'); // duplicate
        expect(manager.getMetadata('sess-1')!.tags).toEqual(['important', 'vip']);
    });

    it('archives session', () => {
        manager.getOrCreate('sess-1');
        manager.archive('sess-1');
        expect(manager.getMetadata('sess-1')!.archived).toBe(true);
    });

    it('deletes session permanently', () => {
        manager.getOrCreate('sess-1');
        manager.appendMessage('sess-1', { role: 'user', content: 'x' });
        manager.delete('sess-1');
        expect(manager.getMetadata('sess-1')).toBeUndefined();
        expect(manager.getMessages('sess-1')).toEqual([]);
    });

    it('cleanup archives expired sessions', () => {
        const meta = manager.getOrCreate('sess-1');
        meta.lastActiveAt = Date.now() - 5000;
        const result = manager.cleanup();
        expect(result.expired).toBe(1);
        expect(result.archived).toBe(1);
        expect(manager.getMetadata('sess-1')!.archived).toBe(true);
    });

    it('cleanup deletes when archiveOnExpiry is false', () => {
        const mgr = new SessionPersistenceManager({ defaultTtlMs: 1000, archiveOnExpiry: false });
        const meta = mgr.getOrCreate('sess-1');
        meta.lastActiveAt = Date.now() - 5000;
        const result = mgr.cleanup();
        expect(result.deleted).toBe(1);
        expect(mgr.getMetadata('sess-1')).toBeUndefined();
    });

    it('export and import session', () => {
        manager.getOrCreate('sess-1', { channel: 'slack' });
        manager.appendMessage('sess-1', { role: 'user', content: 'saved' });
        const exported = manager.export('sess-1');
        expect(exported).not.toBeNull();
        expect(exported!.version).toBe('1.0.0');
        expect(exported!.messages).toHaveLength(1);

        // Import into fresh manager
        const mgr2 = new SessionPersistenceManager();
        expect(mgr2.import(exported!)).toBe(true);
        expect(mgr2.getMetadata('sess-1')!.channel).toBe('slack');
        expect(mgr2.getMessages('sess-1')).toHaveLength(1);
    });

    it('list with filters', () => {
        manager.getOrCreate('s1', { channel: 'discord', userId: 'alice' });
        manager.getOrCreate('s2', { channel: 'slack', userId: 'bob' });
        manager.getOrCreate('s3', { channel: 'discord', userId: 'charlie' });
        manager.addTag('s1', 'vip');

        expect(manager.list({ channel: 'discord' })).toHaveLength(2);
        expect(manager.list({ userId: 'bob' })).toHaveLength(1);
        expect(manager.list({ tag: 'vip' })).toHaveLength(1);
        expect(manager.list({ archived: false })).toHaveLength(3);
    });

    it('getStats returns correct counts', () => {
        manager.getOrCreate('s1');
        manager.getOrCreate('s2');
        manager.appendMessage('s1', { role: 'user', content: 'hello' });
        manager.archive('s2');
        const stats = manager.getStats();
        expect(stats.total).toBe(2);
        expect(stats.archived).toBe(1);
        expect(stats.totalMessages).toBe(1);
    });
});
