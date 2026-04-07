/**
 * CoreBlow Phase 33 — ContextManager & Token Estimation Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Token estimation, budget calculation
 *   - Pin/unpin, shared context, facts, fitToWindow
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager, estimateTokens, estimateMessageTokens } from '../../src/agents/context.js';
import type { ChatMessage } from '../../src/providers/interface.js';

describe('Token Estimation — Edge Cases', () => {
    it('should estimate tokens for English text', () => {
        const tokens = estimateTokens('Hello, how are you today?');
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(20);
    });

    it('should return 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    it('should estimate higher tokens for long text', () => {
        const short = estimateTokens('Hi');
        const long = estimateTokens('This is a much longer text that should have more tokens');
        expect(long).toBeGreaterThan(short);
    });

    it('should estimate message tokens including role overhead', () => {
        const msgs: ChatMessage[] = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there, how can I help?' },
        ];
        const tokens = estimateMessageTokens(msgs);
        expect(tokens).toBeGreaterThan(0);
    });
});

describe('ContextManager — Extended', () => {
    let cm: ContextManager;
    beforeEach(() => { cm = new ContextManager(); });

    it('should calculate budget correctly', () => {
        const budget = cm.calculateBudget(8192);
        expect(budget.maxTokens).toBe(8192);
        expect(budget.systemReserve).toBe(1000);
        expect(budget.responseReserve).toBe(2000);
        expect(budget.historyBudget).toBe(5192);
    });

    it('should enforce minimum history budget', () => {
        const budget = cm.calculateBudget(2000); // Very small
        expect(budget.historyBudget).toBe(500); // Min 500
    });

    it('should pin and retrieve messages', () => {
        const msg: ChatMessage = { role: 'user', content: 'Important info' };
        cm.pin('s1', msg, 10, 'key fact');

        const pinned = cm.getPinned('s1');
        expect(pinned).toHaveLength(1);
        expect(pinned[0]!.priority).toBe(10);
        expect(pinned[0]!.reason).toBe('key fact');
    });

    it('should unpin all messages for session', () => {
        cm.pin('s1', { role: 'user', content: 'msg1' });
        cm.pin('s1', { role: 'user', content: 'msg2' });
        cm.unpin('s1');
        expect(cm.getPinned('s1')).toHaveLength(0);
    });

    it('should unpin specific message by index', () => {
        cm.pin('s1', { role: 'user', content: 'msg1' });
        cm.pin('s1', { role: 'user', content: 'msg2' });
        cm.unpin('s1', 0);
        expect(cm.getPinned('s1')).toHaveLength(1);
    });

    it('should add and retrieve facts', () => {
        cm.addFact('s1', 'User prefers dark mode');
        cm.addFact('s1', 'User speaks English');
        cm.addFact('s1', 'User prefers dark mode'); // Duplicate

        const facts = cm.getFacts('s1');
        expect(facts).toHaveLength(2); // Set deduplicates
    });

    it('should share context across sessions', () => {
        const id = cm.shareContext('s1', 'User preferences', ['likes dark mode', 'speaks English']);
        expect(id).toBeTruthy();

        const shared = cm.listSharedContexts();
        expect(shared).toHaveLength(1);
        expect(shared[0]!.summary).toBe('User preferences');
    });

    it('should remove shared context', () => {
        const id = cm.shareContext('s1', 'summary', ['fact']);
        expect(cm.removeSharedContext(id)).toBe(true);
        expect(cm.listSharedContexts()).toHaveLength(0);
    });

    it('should fitToWindow keeping system and recent messages', () => {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'msg 1' },
            { role: 'assistant', content: 'reply 1' },
            { role: 'user', content: 'msg 2' },
            { role: 'assistant', content: 'reply 2' },
        ];

        const budget = cm.calculateBudget(8192);
        const fitted = cm.fitToWindow(messages, budget);
        expect(fitted[0]!.role).toBe('system');
        expect(fitted.length).toBeGreaterThanOrEqual(1);
    });

    it('should get context stats', () => {
        const messages: ChatMessage[] = [
            { role: 'user', content: 'Hello world' },
            { role: 'assistant', content: 'Hi there!' },
        ];
        cm.pin('s1', messages[0]!);

        const stats = cm.getStats('s1', messages);
        expect(stats.totalMessages).toBe(2);
        expect(stats.pinnedCount).toBe(1);
        expect(stats.estimatedTokens).toBeGreaterThan(0);
    });

    it('should clear session data', () => {
        cm.pin('s1', { role: 'user', content: 'pin' });
        cm.addFact('s1', 'fact');
        cm.clearSession('s1');
        expect(cm.getPinned('s1')).toHaveLength(0);
        expect(cm.getFacts('s1')).toHaveLength(0);
    });
});
