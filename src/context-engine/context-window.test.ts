import { describe, it, expect, beforeEach } from 'vitest';
import { ContextWindowManager, firstLastStrategy, getContextWindowManager } from './context-window.js';
import type { ContextEntry } from './types.js';

describe('ContextWindowManager', () => {
    let manager: ContextWindowManager;

    beforeEach(() => {
        manager = new ContextWindowManager();
    });

    it('creates a new context window', () => {
        const window = manager.create('session-1', 'gpt-4o', 1000);
        expect(window.model).toBe('gpt-4o');
        expect(window.maxTokens).toBe(1000);
        expect(window.currentTokens).toBe(0);
        expect(window.entries).toEqual([]);
        expect(manager.size).toBe(1);
    });

    it('getOrCreate gets existing or creates new', () => {
        const window1 = manager.getOrCreate('sess-1', 'gpt-4o');
        const window2 = manager.getOrCreate('sess-1', 'gpt-4o');
        expect(window1).toBe(window2);
        expect(manager.size).toBe(1);
    });

    it('adds system prompt and user entries', () => {
        manager.create('sess-1', 'gpt-4o');

        manager.addEntry('sess-1', { role: 'system', content: 'You are an AI', tokens: 10 } as ContextEntry);
        manager.addEntry('sess-1', { role: 'user', content: 'Hello', tokens: 5 } as ContextEntry);

        const messages = manager.getMessages('sess-1');
        expect(messages.length).toBe(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(manager.getTokenCount('sess-1')).toBe(15);
    });

    it('compacts automatically when nearing max length using sliding window', () => {
        manager.create('sess-1', 'gpt-4o', 100);

        manager.addEntry('sess-1', { role: 'system', content: 'System', tokens: 10 } as ContextEntry);

        // Add 5 messages, 20 tokens each = 100 tokens. 100 + 10 = 110. (over limit of 100*0.9 = 90)
        for(let i=0; i<5; i++) {
            manager.addEntry('sess-1', { role: 'user', content: `Message ${i}`, tokens: 20 } as ContextEntry);
        }

        const messages = manager.getMessages('sess-1');

        // Should keep system prompt and last few messages that fit into budget (100 * 0.75 = 75)
        // System = 10. Budget left = 65. Can fit 3 messages of 20 tokens (60 tokens).
        // Total messages should be 1 system + 3 messages = 4.
        expect(messages.length).toBe(4);
        expect(messages[0].role).toBe('system');
        expect(messages[1].content).toBe('Message 2');
        expect(manager.getTokenCount('sess-1')).toBe(70);
    });

    it('works with built-in firstLastStrategy', () => {
        manager.create('sess-1', 'gpt-4o', 1000);

        for(let i=0; i<6; i++) {
            manager.addEntry('sess-1', { role: 'user', content: `Msg ${i}`, tokens: 10 } as ContextEntry);
        }

        manager.compact('sess-1', firstLastStrategy);

        const messages = manager.getMessages('sess-1');
        // first-last keeps first 2 and last 2 => 4 entries
        expect(messages.length).toBe(4);
        expect(messages[0].content).toBe('Msg 0');
        expect(messages[1].content).toBe('Msg 1');
        expect(messages[2].content).toBe('Msg 4');
        expect(messages[3].content).toBe('Msg 5');
    });

    it('firstLastStrategy leaves short windows intact', () => {
        manager.create('sess-1', 'gpt-4o', 1000);
        for(let i=0; i<3; i++) {
            manager.addEntry('sess-1', { role: 'user', content: `Msg ${i}`, tokens: 10 } as ContextEntry);
        }
        manager.compact('sess-1', firstLastStrategy);
        const messages = manager.getMessages('sess-1');
        expect(messages.length).toBe(3);
    });

    it('removes window correctly', () => {
        manager.create('sess-1', 'gpt-4o', 1000);
        expect(manager.size).toBe(1);
        manager.remove('sess-1');
        expect(manager.size).toBe(0);
        expect(manager.getMessages('sess-1')).toEqual([]);
    });

    it('singleton getContextWindowManager returns the same instance', () => {
        const inst1 = getContextWindowManager();
        const inst2 = getContextWindowManager();
        expect(inst1).toBe(inst2);
    });
});
