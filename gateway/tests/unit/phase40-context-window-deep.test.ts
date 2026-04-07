/**
 * CoreBlow Phase 40 — Context Window Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ContextWindow: create, add, compact, strategies
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextWindowManager, firstLastStrategy } from '../../src/context-engine/context-window.js';

describe('ContextWindowManager — Extended', () => {
    let manager: ContextWindowManager;

    beforeEach(() => {
        manager = new ContextWindowManager();
    });

    const createMessage = (content: string, tokens: number, role = 'user') => ({ role, content, tokens });

    it('should create and retrieve window', () => {
        const win = manager.create('s1', 'gpt-4o', 100);
        expect(win.model).toBe('gpt-4o');
        expect(win.maxTokens).toBe(100);
        expect(manager.size).toBe(1);
    });

    it('should set system prompt correctly', () => {
        manager.create('s1', 'gpt-4o');
        manager.addEntry('s1', createMessage('System', 10, 'system'));
        manager.addEntry('s1', createMessage('User', 5));

        const msgs = manager.getMessages('s1');
        expect(msgs[0]?.role).toBe('system');
        expect(msgs[1]?.role).toBe('user');
        expect(msgs).toHaveLength(2);
    });

    it('should add second system prompt to regular entries', () => {
        manager.create('s1', 'm');
        manager.addEntry('s1', createMessage('Sys1', 10, 'system'));
        manager.addEntry('s1', createMessage('Sys2', 10, 'system'));
        const msgs = manager.getMessages('s1');
        expect(msgs).toHaveLength(2);
        expect(msgs[0]?.content).toBe('Sys1');
        expect(msgs[1]?.content).toBe('Sys2');
    });

    it('should auto-compact when nearing token limit', () => {
        manager.create('s1', 'm', 100); // limit 100
        for (let i = 0; i < 20; i++) {
            manager.addEntry('s1', createMessage(`Msg ${i}`, 10));
        }
        const tokens = manager.getTokenCount('s1');
        // Will auto compact
        expect(tokens).toBeLessThanOrEqual(100);
    });

    it('first-last strategy keeps boundaries', () => {
        manager.create('s1', 'm');
        for (let i = 0; i < 10; i++) {
            manager.addEntry('s1', createMessage(`${i}`, 10));
        }

        manager.compact('s1', firstLastStrategy);
        const msgs = manager.getMessages('s1');
        expect(msgs).toHaveLength(4); // first 2, last 2
        expect(msgs[0]?.content).toBe('0');
        expect(msgs[1]?.content).toBe('1');
        expect(msgs[2]?.content).toBe('8');
        expect(msgs[3]?.content).toBe('9');
    });

    it('should remove session window', () => {
        manager.create('s1', 'm');
        expect(manager.size).toBe(1);
        manager.remove('s1');
        expect(manager.size).toBe(0);
    });
});
