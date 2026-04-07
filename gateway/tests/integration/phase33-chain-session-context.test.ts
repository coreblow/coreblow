/**
 * CoreBlow Phase 33 — Session→Context→Messages Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   SessionPersistenceManager.getOrCreate → appendMessage →
 *   ContextManager.fitToWindow → pin → share → export
 */
import { describe, it, expect } from 'vitest';
import { SessionPersistenceManager } from '../../src/agents/session-persistence.js';
import { ContextManager, estimateMessageTokens } from '../../src/agents/context.js';
import type { ChatMessage } from '../../src/providers/interface.js';

describe('Phase33 Chain: Session→Context→Messages Pipeline', () => {

    it('create session → append messages → fit to context window', () => {
        const spm = new SessionPersistenceManager();
        const ctx = new ContextManager();

        // Step 1: Create session
        const session = spm.getOrCreate('conv-1', { agentId: 'assistant', channel: 'web', userId: 'u1' });
        expect(session.id).toBe('conv-1');

        // Step 2: Simulate conversation
        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'What is machine learning?' },
            { role: 'assistant', content: 'Machine learning is a branch of AI that enables systems to learn from data.' },
            { role: 'user', content: 'Can you give me an example?' },
            { role: 'assistant', content: 'Sure! Email spam filters use ML to classify emails.' },
        ];

        for (const msg of messages) {
            spm.appendMessage('conv-1', msg);
        }

        // Step 3: Fit to context window
        const budget = ctx.calculateBudget(8192);
        const fitted = ctx.fitToWindow(spm.getMessages('conv-1'), budget);

        // System message always first
        expect(fitted[0]?.role).toBe('system');
        // All messages should fit in 8192 token budget
        expect(fitted.length).toBe(5);

        // Token count within budget
        const tokens = estimateMessageTokens(fitted);
        expect(tokens).toBeLessThan(budget.historyBudget);
    });

    it('pin important message → survives context compression', () => {
        const spm = new SessionPersistenceManager();
        const ctx = new ContextManager();

        spm.getOrCreate('conv-2', { agentId: 'a1' });

        const importantMsg: ChatMessage = { role: 'assistant', content: 'Your API key is configured correctly.' };
        spm.appendMessage('conv-2', { role: 'system', content: 'You are an API assistant' });
        spm.appendMessage('conv-2', { role: 'user', content: 'Check my config' });
        spm.appendMessage('conv-2', importantMsg);

        // Pin the important message
        ctx.pin('conv-2', importantMsg, 10, 'Config verification result');

        // Fit to window — pinned message should be included
        const budget = ctx.calculateBudget(8192);
        const fitted = ctx.fitToWindow(spm.getMessages('conv-2'), budget, 'conv-2');

        const pinnedInFitted = fitted.some(m => m.content === importantMsg.content);
        expect(pinnedInFitted).toBe(true);
    });

    it('share context from session A → inject into session B', () => {
        const spm = new SessionPersistenceManager();
        const ctx = new ContextManager();

        // Session A: extract facts
        spm.getOrCreate('session-a', { agentId: 'a1' });
        ctx.addFact('session-a', 'User prefers dark mode');
        ctx.addFact('session-a', 'User speaks French');

        // Share context
        ctx.shareContext('session-a', 'User preferences', ctx.getFacts('session-a'));

        // Session B: should receive shared context
        spm.getOrCreate('session-b', { agentId: 'a1' });
        spm.appendMessage('session-b', { role: 'system', content: 'You are an assistant' });
        spm.appendMessage('session-b', { role: 'user', content: 'Hello' });

        const budget = ctx.calculateBudget(8192);
        const fitted = ctx.fitToWindow(spm.getMessages('session-b'), budget, 'session-b');

        // Should find injected shared context
        const hasShared = fitted.some(m => m.content?.includes('User preferences'));
        expect(hasShared).toBe(true);
    });

    it('export session → import into new manager → context intact', () => {
        const spm1 = new SessionPersistenceManager();
        spm1.getOrCreate('s1', { agentId: 'a1', channel: 'web' });
        spm1.appendMessage('s1', { role: 'user', content: 'Remember this' });
        spm1.appendMessage('s1', { role: 'assistant', content: 'I will remember' });
        spm1.addTag('s1', 'important');

        const exported = spm1.export('s1')!;

        // Import into fresh manager
        const spm2 = new SessionPersistenceManager();
        spm2.import(exported);

        // Context should be intact
        const ctx = new ContextManager();
        const budget = ctx.calculateBudget(8192);
        const fitted = ctx.fitToWindow(spm2.getMessages('s1'), budget);
        expect(fitted).toHaveLength(2);
        expect(spm2.getMetadata('s1')?.agentId).toBe('a1');
    });
});
