/**
 * sessions/session-manager.test.ts — Session manager tests
 */
import { describe, it, expect } from 'vitest';
import { SessionManager } from './session-manager.js';

describe('SessionManager', () => {
    it('should create session', () => {
        const mgr = new SessionManager();
        const id = mgr.create('s1', 'gpt-4o');
        expect(id).toBe('s1');
        expect(mgr.get('s1')?.model).toBe('gpt-4o');
    });

    it('should add messages', () => {
        const mgr = new SessionManager();
        mgr.create('s1', 'gpt-4o');
        mgr.addMessage('s1', { role: 'user', content: 'hello' });
        expect(mgr.get('s1')?.messages).toHaveLength(1);
    });

    it('should delete session', () => {
        const mgr = new SessionManager();
        mgr.create('s1', 'gpt-4o');
        mgr.delete('s1');
        expect(mgr.get('s1')).toBeUndefined();
    });

    it('should list and count sessions', () => {
        const mgr = new SessionManager();
        mgr.create('s1', 'gpt-4o');
        mgr.create('s2', 'claude');
        expect(mgr.list()).toHaveLength(2);
        expect(mgr.count()).toBe(2);
    });
});
