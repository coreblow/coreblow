/**
 * CoreBlow Phase 33 — SessionPersistenceManager Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Session CRUD, TTL, archival, import/export
 *   - Filtering, stats, cleanup logic, tags
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionPersistenceManager } from '../../src/agents/session-persistence.js';

describe('SessionPersistenceManager — Extended', () => {
    let spm: SessionPersistenceManager;
    beforeEach(() => {
        spm = new SessionPersistenceManager({ defaultTtlMs: 1000, maxSessions: 10 });
    });

    it('should create session with defaults', () => {
        const s = spm.getOrCreate('s1', { agentId: 'agent-1', channel: 'web', userId: 'u1' });
        expect(s.id).toBe('s1');
        expect(s.agentId).toBe('agent-1');
        expect(s.channel).toBe('web');
        expect(s.messageCount).toBe(0);
        expect(s.archived).toBe(false);
    });

    it('should return existing session on second getOrCreate', () => {
        const s1 = spm.getOrCreate('s1', { agentId: 'a1' });
        const s2 = spm.getOrCreate('s1', { agentId: 'different' });
        expect(s2.agentId).toBe('a1'); // Original value preserved
    });

    it('should append messages and update count', () => {
        spm.getOrCreate('s1');
        spm.appendMessage('s1', { role: 'user', content: 'Hello' });
        spm.appendMessage('s1', { role: 'assistant', content: 'Hi there' });

        const msgs = spm.getMessages('s1');
        expect(msgs).toHaveLength(2);
        expect(spm.getMetadata('s1')?.messageCount).toBe(2);
    });

    it('should ignore appendMessage for non-existent session', () => {
        spm.appendMessage('ghost', { role: 'user', content: 'test' });
        expect(spm.getMessages('ghost')).toHaveLength(0);
    });

    it('should tag sessions', () => {
        spm.getOrCreate('s1');
        spm.addTag('s1', 'vip');
        spm.addTag('s1', 'support');
        spm.addTag('s1', 'vip'); // Duplicate — should be ignored

        expect(spm.getMetadata('s1')?.tags).toEqual(['vip', 'support']);
    });

    it('should archive sessions', () => {
        spm.getOrCreate('s1');
        expect(spm.archive('s1')).toBe(true);
        expect(spm.getMetadata('s1')?.archived).toBe(true);
    });

    it('should delete sessions permanently', () => {
        spm.getOrCreate('s1');
        spm.appendMessage('s1', { role: 'user', content: 'test' });
        expect(spm.delete('s1')).toBe(true);
        expect(spm.getMetadata('s1')).toBeUndefined();
        expect(spm.getMessages('s1')).toHaveLength(0);
    });

    it('should set custom TTL', () => {
        spm.getOrCreate('s1');
        expect(spm.setTtl('s1', 5000)).toBe(true);
        expect(spm.getMetadata('s1')?.ttlMs).toBe(5000);
    });

    it('should export and import sessions', () => {
        spm.getOrCreate('s1', { agentId: 'a1', channel: 'web' });
        spm.appendMessage('s1', { role: 'user', content: 'Hello' });
        spm.addTag('s1', 'important');

        const exported = spm.export('s1');
        expect(exported).not.toBeNull();
        expect(exported?.metadata.agentId).toBe('a1');
        expect(exported?.messages).toHaveLength(1);

        // Import into fresh manager
        const spm2 = new SessionPersistenceManager();
        expect(spm2.import(exported!)).toBe(true);
        expect(spm2.getMetadata('s1')?.agentId).toBe('a1');
        expect(spm2.getMessages('s1')).toHaveLength(1);
    });

    it('should filter sessions by channel', () => {
        spm.getOrCreate('s1', { channel: 'web' });
        spm.getOrCreate('s2', { channel: 'telegram' });
        spm.getOrCreate('s3', { channel: 'web' });

        const webSessions = spm.list({ channel: 'web' });
        expect(webSessions).toHaveLength(2);
    });

    it('should filter by archived status', () => {
        spm.getOrCreate('s1');
        spm.getOrCreate('s2');
        spm.archive('s2');

        expect(spm.list({ archived: false })).toHaveLength(1);
        expect(spm.list({ archived: true })).toHaveLength(1);
    });

    it('should report stats', () => {
        spm.getOrCreate('s1');
        spm.getOrCreate('s2');
        spm.appendMessage('s1', { role: 'user', content: 'msg' });
        spm.archive('s2');

        const stats = spm.getStats();
        expect(stats.total).toBe(2);
        expect(stats.active).toBe(1);
        expect(stats.archived).toBe(1);
        expect(stats.totalMessages).toBe(1);
    });
});
