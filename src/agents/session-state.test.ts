import { describe, it, expect } from 'vitest';
import { AgentSession } from './session-state.js';

describe('Agent Session', () => {
    it('creates with defaults', () => {
        const session = new AgentSession('s1', 'agent-a');
        const state = session.getState();
        expect(state.sessionId).toBe('s1');
        expect(state.agentId).toBe('agent-a');
        expect(state.status).toBe('idle');
        expect(state.turnCount).toBe(0);
    });

    it('adds messages', () => {
        const session = new AgentSession('s1', 'a');
        session.addMessage({ role: 'user', content: 'hello' });
        session.addMessage({ role: 'assistant', content: 'hi there' });
        expect(session.getMessages()).toHaveLength(2);
    });

    it('increments turn count on user messages', () => {
        const session = new AgentSession('s1', 'a');
        session.addMessage({ role: 'user', content: 'q1' });
        session.addMessage({ role: 'assistant', content: 'a1' });
        session.addMessage({ role: 'user', content: 'q2' });
        expect(session.getState().turnCount).toBe(2);
    });

    it('sets status', () => {
        const session = new AgentSession('s1', 'a');
        session.setStatus('active');
        expect(session.getState().status).toBe('active');
        expect(session.isActive()).toBe(true);
    });

    it('records usage', () => {
        const session = new AgentSession('s1', 'a');
        session.recordUsage(1000, 500, 0.05);
        const state = session.getState();
        expect(state.totalInputTokens).toBe(1000);
        expect(state.totalOutputTokens).toBe(500);
        expect(state.totalCost).toBe(0.05);
    });

    it('manages metadata', () => {
        const session = new AgentSession('s1', 'a');
        session.setMetadata('key', 'value');
        expect(session.getMetadata('key')).toBe('value');
    });

    it('terminates', () => {
        const session = new AgentSession('s1', 'a');
        session.setStatus('active');
        session.terminate();
        expect(session.isTerminated()).toBe(true);
        expect(session.isActive()).toBe(false);
    });

    it('compacts history', () => {
        const session = new AgentSession('s1', 'a');
        for (let i = 0; i < 50; i++) session.addMessage({ role: 'user', content: `msg ${i}` });
        const removed = session.compact(10);
        expect(removed).toBe(40);
        expect(session.getMessages()).toHaveLength(10);
    });

    it('enforces max history length', () => {
        const session = new AgentSession('s1', 'a', { maxHistoryLength: 5 });
        for (let i = 0; i < 20; i++) session.addMessage({ role: 'user', content: `msg ${i}` });
        expect(session.getMessages()).toHaveLength(5);
    });

    it('gets last N messages', () => {
        const session = new AgentSession('s1', 'a');
        for (let i = 0; i < 10; i++) session.addMessage({ role: 'user', content: `msg ${i}` });
        expect(session.getLastMessages(3)).toHaveLength(3);
    });

    it('formats status line', () => {
        const session = new AgentSession('s1', 'agent-x');
        session.setStatus('active');
        session.addMessage({ role: 'user', content: 'hello' });
        session.recordUsage(100, 50);
        const line = session.formatStatusLine();
        expect(line).toContain('s1');
        expect(line).toContain('agent-x');
        expect(line).toContain('active');
    });
});
