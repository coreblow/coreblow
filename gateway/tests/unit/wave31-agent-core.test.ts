/**
 * Wave 31: Agent Core (Runtime, Lifecycle, Context)
 * TARGET: ~40 tests
 *
 * Replaces OpenClaw's engine/agent-runtime.ts + context-engine/windowed-context.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRuntime, AgentSession, type ModelProvider } from '../../src/agents/runtime.js';
import { LifecycleManager } from '../../src/agents/lifecycle.js';
import { ContextManager as WindowContextManager } from '../../src/agents/context-manager.js';
import { ContextManager as SmartContextManager, estimateTokens, estimateMessageTokens } from '../../src/agents/context.js';

// ─── Mock Provider ────────────────────────────────────────────────────────
class MockProvider implements ModelProvider {
    id = 'mock';
    name = 'Mock Provider';
    callCount = 0;

    async chat(params: any) {
        this.callCount++;
        const lastMsg = params.messages[params.messages.length - 1];

        if (lastMsg.content === 'generate_error') throw new Error('Simulated model error');

        if (lastMsg.content === 'use_tool') {
            return {
                content: '',
                toolCalls: [{ id: 'call_1', name: 'weather', arguments: '{"loc":"nyc"}' }],
                usage: { input: 10, output: 20, total: 30 }
            };
        }

        return {
            content: 'Mock response to: ' + lastMsg.content,
            usage: { input: 10, output: 20, total: 30 }
        };
    }
}

// ─── AgentRuntime: Registration & Sessions ────────────────────────────────

describe('AgentRuntime', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        runtime = new AgentRuntime();
        runtime.registerProvider(new MockProvider(), true);
    });

    it('creates and retrieves a session', () => {
        const session = runtime.createSession('sess_1', { model: 'mock-model' });
        expect(session).toBeInstanceOf(AgentSession);
        expect(runtime.getSession('sess_1')).toBe(session);
    });

    it('returns null for unknown session', () => {
        expect(runtime.getSession('no_such')).toBeNull();
    });

    it('prevents duplicate session creation', () => {
        runtime.createSession('sess_1', { model: 'mock-model' });
        expect(() => runtime.createSession('sess_1', { model: 'mock-model' })).toThrow(/already exists/);
    });

    it('requires a registered provider', () => {
        const emptyRuntime = new AgentRuntime();
        expect(() => emptyRuntime.createSession('sess_1', { model: 'mock-model' })).toThrow(/No model provider/);
    });

    it('can destroy a session', () => {
        runtime.createSession('sess_1', { model: 'mock-model' });
        expect(runtime.destroySession('sess_1')).toBe(true);
        expect(runtime.getSession('sess_1')).toBeNull();
    });

    it('returns false when destroying nonexistent session', () => {
        expect(runtime.destroySession('fake')).toBe(false);
    });

    it('lists active sessions', () => {
        runtime.createSession('sess_1', { model: 'mock-model' });
        runtime.createSession('sess_2', { model: 'mock-model' });
        const list = runtime.listSessions();
        expect(list).toHaveLength(2);
        expect(list.map(s => s.id)).toContain('sess_1');
        expect(list.map(s => s.id)).toContain('sess_2');
    });

    it('registers and lists providers', () => {
        // providers are stored internally; check via session creation works
        expect(() => runtime.createSession('check_prov', { model: 'mock-model' })).not.toThrow();
    });
});

// ─── AgentSession: Messaging ──────────────────────────────────────────────

describe('AgentSession', () => {
    let runtime: AgentRuntime;
    let session: AgentSession;

    beforeEach(() => {
        runtime = new AgentRuntime();
        runtime.registerProvider(new MockProvider(), true);
        session = runtime.createSession('sess_1', {
            model: 'mock-model',
            systemPrompt: 'You are helpful.',
            tokenBudget: 300,
            tools: [{
                name: 'weather',
                description: 'Get weather',
                parameters: { type: 'object' },
                handler: async (args: any) => `Weather for ${args.loc} is sunny`
            }]
        });
    });

    it('initializes with a system prompt', () => {
        const messages = session.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toBe('You are helpful.');
    });

    it('returns idle state initially', () => {
        expect(session.getState()).toBe('idle');
    });

    it('chats successfully', async () => {
        const response = await session.chat('hello');
        expect(response).toBe('Mock response to: hello');
        expect(session.getState()).toBe('idle');
    });

    it('adds user + assistant messages during chat', async () => {
        await session.chat('hello');
        const msgs = session.getMessages();
        expect(msgs).toHaveLength(3); // system, user, assistant
        expect(msgs[1].role).toBe('user');
        expect(msgs[2].role).toBe('assistant');
    });

    it('handles multiple turns', async () => {
        await session.chat('turn1');
        await session.chat('turn2');
        const msgs = session.getMessages();
        // system + 2 user + 2 assistant = 5
        expect(msgs).toHaveLength(5);
    });

    it('handles tool calls automatically', async () => {
        let chatCalled = 0;
        const provider = runtime['providers'].get('mock')!;
        const original = provider.chat.bind(provider);
        provider.chat = async (params: any) => {
            chatCalled++;
            if (chatCalled === 1) {
                return { content: '', toolCalls: [{ id: 'call_1', name: 'weather', arguments: '{"loc":"nyc"}' }], usage: { input: 10, output: 20, total: 30 } };
            }
            const toolMsg = params.messages[params.messages.length - 2]?.content || '';
            return { content: 'Tool result: ' + toolMsg, usage: { input: 10, output: 20, total: 30 } };
        };

        const response = await session.chat('use_tool');
        expect(response).toContain('Tool result: Weather for nyc is sunny');
        const roles = session.getMessages().map(m => m.role);
        expect(roles).toContain('tool');
        provider.chat = original;
    });

    it('tracks token usage cumulatively', async () => {
        await session.chat('hello');
        const after1 = session.getTokenUsage().total;
        await session.chat('again');
        const after2 = session.getTokenUsage().total;
        expect(after2).toBeGreaterThan(after1);
    });

    it('detects budget exceeded', async () => {
        // budget = 300, each chat = 30 tokens, 10 chats = 300
        for (let i = 0; i < 10; i++) await session.chat('hi');
        expect(session.isBudgetExceeded()).toBe(true);
    });

    it('handles streaming callback', async () => {
        let streamCount = 0;
        await session.chat('hello', (chunk, done) => { streamCount++; });
        expect(streamCount).toBeGreaterThan(0);
    });

    it('handles errors and transitions to error state', async () => {
        await expect(session.chat('generate_error')).rejects.toThrow('Simulated model error');
        expect(session.getState()).toBe('error');
    });

    it('resets the session but keeps system prompt', async () => {
        await session.chat('hello');
        session.reset();
        expect(session.getMessages()).toHaveLength(1);
        expect(session.getMessages()[0].role).toBe('system');
        expect(session.getTokenUsage().total).toBe(0);
    });
});

// ─── LifecycleManager ─────────────────────────────────────────────────────

describe('LifecycleManager', () => {
    let manager: LifecycleManager;

    beforeEach(() => {
        manager = new LifecycleManager();
    });

    it('starts and tracks active turn context', () => {
        const id = manager.start({ sessionId: 's1', channelId: 'c1', model: 'm1' });
        expect(id).toBe('s1');
        const active = manager.getActive();
        expect(active).toHaveLength(1);
    });

    it('stops removes from active list', () => {
        manager.start({ sessionId: 's1', channelId: 'c1', model: 'm1' });
        manager.stop('s1');
        expect(manager.getActive()).toHaveLength(0);
    });

    it('does not fail stopping unknown session', () => {
        expect(() => manager.stop('no-such')).not.toThrow();
    });

    it('handles multiple concurrent sessions', () => {
        manager.start({ sessionId: 's1', channelId: 'c1', model: 'm1' });
        manager.start({ sessionId: 's2', channelId: 'c2', model: 'm1' });
        expect(manager.getActive()).toHaveLength(2);
        manager.stop('s1');
        expect(manager.getActive()).toHaveLength(1);
    });

    it('stores channelId metadata correctly', () => {
        manager.start({ sessionId: 's1', channelId: 'chan999', model: 'm1' });
        const active = manager.getActive();
        expect((active[0] as any).channelId).toBe('chan999');
    });
});

// ─── WindowContextManager ─────────────────────────────────────────────────

describe('WindowContextManager', () => {
    it('adds messages and tracks count', () => {
        const manager = new WindowContextManager();
        manager.add('system', 'sys');
        manager.add('user', 'user msg');
        expect(manager.count()).toBe(2);
    });

    it('estimates tokens per message', () => {
        const manager = new WindowContextManager();
        manager.add('user', 'short');
        const stats = manager.getStats();
        expect(stats.userTokens).toBeGreaterThan(0);
    });

    it('trims low-priority messages to fit window', () => {
        const manager = new WindowContextManager(100, 20); // tight budget
        manager.add('system', 'System rules', 10);
        manager.add('user', 'A'.repeat(40 * 4), 5);
        manager.add('assistant', 'B'.repeat(40 * 4), 6);
        manager.add('user', 'C'.repeat(40 * 4), 7);
        const stats = manager.getStats();
        expect(stats.totalTokens).toBeLessThanOrEqual(80);
    });

    it('computes role-specific token stats', () => {
        const manager = new WindowContextManager();
        manager.add('system', 'sys');
        manager.add('user', 'usr');
        manager.add('assistant', 'ast');
        const stats = manager.getStats();
        expect(stats.totalMessages).toBe(3);
        expect(stats.systemTokens).toBeGreaterThan(0);
        expect(stats.userTokens).toBeGreaterThan(0);
        expect(stats.assistantTokens).toBeGreaterThan(0);
    });

    it('getAvailableTokens reflects remaining budget', () => {
        const manager = new WindowContextManager(100, 20);
        const available = manager.getAvailableTokens();
        expect(available).toBeGreaterThan(0);
        expect(available).toBeLessThanOrEqual(80);
    });

    it('compacts old messages into a single summary', () => {
        const manager = new WindowContextManager();
        manager.add('system', 'sys');
        manager.add('user', 'old1');
        manager.add('assistant', 'old2');
        manager.add('user', 'recent1');
        manager.add('assistant', 'recent2');
        manager.compact('This is a summary');
        const msgs = manager.getMessages();
        expect(msgs.length).toBeLessThan(5);
        expect(msgs.some(m => m.content.includes('This is a summary'))).toBe(true);
    });

    it('clearHistory removes all non-system messages', () => {
        const manager = new WindowContextManager();
        manager.add('system', 'sys');
        manager.add('user', 'old');
        manager.clearHistory();
        expect(manager.count()).toBe(1);
        expect(manager.getMessages()[0].role).toBe('system');
    });

    it('getMessages returns role+content pairs', () => {
        const manager = new WindowContextManager();
        manager.add('user', 'hello');
        const msgs = manager.getMessages();
        expect(msgs[0]).toHaveProperty('role');
        expect(msgs[0]).toHaveProperty('content');
    });
});

// ─── SmartContextManager ──────────────────────────────────────────────────

describe('SmartContextManager', () => {
    it('estimateTokens yields positive integer', () => {
        expect(estimateTokens('test')).toBeGreaterThan(0);
        expect(estimateTokens('hello world today')).toBeGreaterThan(0);
        expect(estimateTokens('')).toBe(0);
    });

    it('estimateMessageTokens sums all messages + overhead', () => {
        const count = estimateMessageTokens([
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'hi there' }
        ]);
        expect(count).toBeGreaterThan(4);
    });

    it('calculates correct budget distribution', () => {
        const manager = new SmartContextManager();
        const budget = manager.calculateBudget(4000);
        expect(budget.maxTokens).toBe(4000);
        expect(budget.systemReserve).toBe(1000);
        expect(budget.responseReserve).toBe(2000);
        expect(budget.historyBudget).toBe(1000);
    });

    it('pins messages with reason', () => {
        const manager = new SmartContextManager();
        manager.pin('sess1', { role: 'user', content: 'important fact' }, 10, 'user request');
        const pinned = manager.getPinned('sess1');
        expect(pinned).toHaveLength(1);
        expect(pinned[0].reason).toBe('user request');
    });

    it('unpins all for session', () => {
        const manager = new SmartContextManager();
        manager.pin('sess1', { role: 'user', content: 'pin1' }, 5, 'r1');
        manager.pin('sess1', { role: 'user', content: 'pin2' }, 5, 'r2');
        manager.unpin('sess1');
        expect(manager.getPinned('sess1')).toHaveLength(0);
    });

    it('addFact and getFacts', () => {
        const manager = new SmartContextManager();
        manager.addFact('sess1', 'User likes red');
        manager.addFact('sess1', 'User likes blue');
        const facts = manager.getFacts('sess1');
        expect(facts).toContain('User likes red');
        expect(facts).toContain('User likes blue');
    });

    it('shareContext creates shared entry', () => {
        const manager = new SmartContextManager();
        manager.addFact('sess1', 'Fact A');
        const facts = manager.getFacts('sess1');
        const sharedId = manager.shareContext('sess1', 'Summary here', facts);
        const shared = manager.listSharedContexts().find(s => s.id === sharedId);
        expect(shared?.summary).toBe('Summary here');
        expect(shared?.facts).toEqual(facts);
    });
});
