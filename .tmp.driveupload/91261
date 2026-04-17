/**
 * agents/agent-engine.test.ts
 * Tests for AgentEngine facade, tool definitions, and stream bridge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEngine, type EngineSession } from './agent-engine.js';
import { mergeEngineConfig, DEFAULT_ENGINE_CONFIG, DEFAULT_TOOL_APPROVAL, ANTHROPIC_PROVIDER } from './agent-engine-config.js';
import { registerBuiltinTools } from './tool-definitions.js';
import { AgentStreamBridge } from './agent-stream-bridge.js';
import type { ModelProvider, ToolCall, TokenUsage } from './runtime.js';

// ─── Mock Provider ─────────────────────────────────────────────

function createMockProvider(responses?: string[]): ModelProvider {
    let callCount = 0;
    return {
        id: 'mock',
        name: 'Mock Provider',
        chat: vi.fn(async () => {
            const content = responses?.[callCount] ?? `Mock response ${callCount}`;
            callCount++;
            return {
                content,
                usage: { input: 100, output: 50, total: 150 } as TokenUsage,
                finishReason: 'end_turn',
            };
        }),
    };
}

function createToolCallingProvider(): ModelProvider {
    let callCount = 0;
    return {
        id: 'mock-tools',
        name: 'Mock Tool Provider',
        chat: vi.fn(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    content: '',
                    toolCalls: [{ id: 'tc1', name: 'list_dir', arguments: '{"path":"/tmp"}' }] as ToolCall[],
                    usage: { input: 100, output: 50, total: 150 } as TokenUsage,
                };
            }
            return {
                content: 'Here are the files.',
                usage: { input: 80, output: 30, total: 110 } as TokenUsage,
                finishReason: 'end_turn',
            };
        }),
    };
}

// ─── Config Tests ──────────────────────────────────────────────

describe('AgentEngineConfig', () => {
    it('mergeEngineConfig applies defaults', () => {
        const config = mergeEngineConfig({ maxOutputTokens: 4096 });
        expect(config.maxOutputTokens).toBe(4096);
        expect(config.defaultProvider).toBe('anthropic');
        expect(config.maxContextTokens).toBe(200_000);
    });

    it('DEFAULT_TOOL_APPROVAL follows OpenClaw pattern', () => {
        expect(DEFAULT_TOOL_APPROVAL.autoApproveTools).toContain('read_file');
        expect(DEFAULT_TOOL_APPROVAL.autoApproveTools).toContain('search');
        expect(DEFAULT_TOOL_APPROVAL.requireApprovalTools).toContain('bash');
        expect(DEFAULT_TOOL_APPROVAL.requireApprovalTools).toContain('write_file');
        expect(DEFAULT_TOOL_APPROVAL.defaultMode).toBe('require_approval');
    });

    it('ANTHROPIC_PROVIDER defaults', () => {
        expect(ANTHROPIC_PROVIDER.id).toBe('anthropic');
        expect(ANTHROPIC_PROVIDER.defaultModel).toContain('claude');
    });
});

// ─── AgentEngine Tests ─────────────────────────────────────────

describe('AgentEngine', () => {
    let engine: AgentEngine;

    beforeEach(() => {
        engine = new AgentEngine();
    });

    it('creates with defaults', () => {
        expect(engine.config.defaultProvider).toBe('anthropic');
        expect(engine.config.enableStreaming).toBe(true);
        expect(engine.getSessionCount()).toBe(0);
    });

    it('registers provider', () => {
        const provider = createMockProvider();
        engine.registerProvider(provider, true);
        expect(engine.getProvider('mock')).toBe(provider);
    });

    it('creates and destroys sessions', () => {
        const id = engine.createSession({ model: 'claude-3' });
        expect(id).toBeTruthy();
        expect(engine.getSession(id)).not.toBeNull();
        expect(engine.getSession(id)!.model).toBe('claude-3');
        expect(engine.getSessionCount()).toBe(1);
        expect(engine.destroySession(id)).toBe(true);
        expect(engine.getSessionCount()).toBe(0);
    });

    it('creates session with system prompt', () => {
        const id = engine.createSession({ systemPrompt: 'You are a helper' });
        const session = engine.getSession(id)!;
        expect(session.messages[0].role).toBe('system');
        expect(session.messages[0].content).toBe('You are a helper');
    });

    it('lists sessions', () => {
        engine.createSession({ model: 'a' });
        engine.createSession({ model: 'b' });
        const list = engine.listSessions();
        expect(list).toHaveLength(2);
    });

    it('destroySession returns false for unknown id', () => {
        expect(engine.destroySession('nonexistent')).toBe(false);
    });

    it('runTurn throws on unknown session', async () => {
        await expect(engine.runTurn('bad', 'hello')).rejects.toThrow('not found');
    });

    it('runTurn throws on no provider', async () => {
        const id = engine.createSession();
        await expect(engine.runTurn(id, 'hello')).rejects.toThrow('not registered');
    });

    it('runTurn succeeds with mock provider', async () => {
        const provider = createMockProvider(['Hello from Claude!']);
        engine.registerProvider(provider, true);
        const id = engine.createSession({ provider: 'mock' });
        const result = await engine.runTurn(id, 'Hi');
        expect(result.responseText).toBe('Hello from Claude!');
        expect(result.sessionId).toBe(id);
        expect(result.turnNumber).toBe(1);
        expect(result.usage.inputTokens).toBe(100);
        expect(result.usage.outputTokens).toBe(50);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.finishReason).toBe('end_turn');
    });

    it('runTurn tracks usage', async () => {
        const provider = createMockProvider(['r1', 'r2']);
        engine.registerProvider(provider, true);
        const id = engine.createSession({ provider: 'mock' });
        await engine.runTurn(id, 'turn 1');
        await engine.runTurn(id, 'turn 2');
        const session = engine.getSession(id)!;
        expect(session.turnCount).toBe(2);
        expect(session.totalTokens).toBe(300);
    });

    it('runTurn calls onChunk for streaming', async () => {
        const provider = createMockProvider(['Streamed!']);
        engine.registerProvider(provider, true);
        const id = engine.createSession({ provider: 'mock' });
        const chunks: unknown[] = [];
        await engine.runTurn(id, 'Hi', (chunk) => chunks.push(chunk));
        expect(chunks.length).toBeGreaterThanOrEqual(2); // text + done
    });

    it('runTurn handles tool calls', async () => {
        const provider = createToolCallingProvider();
        engine.registerProvider(provider, true);
        registerBuiltinTools(engine);
        const id = engine.createSession({ provider: 'mock-tools' });
        const result = await engine.runTurn(id, 'List /tmp');
        expect(result.responseText).toBe('Here are the files.');
        expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
        expect(result.toolCalls[0].name).toBe('list_dir');
    });

    it('shutdown aborts all sessions', () => {
        engine.createSession();
        engine.createSession();
        engine.shutdown();
        expect(engine.getSessionCount()).toBe(0);
    });

    it('tool policy blocks denied tools', () => {
        const policy = engine.getToolPolicy();
        expect(policy.evaluate('read_file').decision).toBe('allow');
    });

    it('exposes usage tracker', () => {
        expect(engine.getUsageTracker()).toBeDefined();
    });
});

// ─── Tool Definitions Tests ────────────────────────────────────

describe('registerBuiltinTools', () => {
    it('registers all built-in tools', () => {
        const engine = new AgentEngine();
        registerBuiltinTools(engine);
        const catalog = engine.getToolCatalog();
        const tools = catalog.listEnabled();
        const names = tools.map(t => t.name);
        expect(names).toContain('bash');
        expect(names).toContain('read_file');
        expect(names).toContain('write_file');
        expect(names).toContain('edit_file');
        expect(names).toContain('search');
        expect(names).toContain('list_dir');
        expect(names).toContain('glob');
        expect(tools.length).toBeGreaterThanOrEqual(7);
    });
});

// ─── AgentStreamBridge Tests ───────────────────────────────────

describe('AgentStreamBridge', () => {
    let bridge: AgentStreamBridge;

    beforeEach(() => { bridge = new AgentStreamBridge(); });

    it('subscribe and receive chunks', () => {
        const received: string[] = [];
        bridge.subscribe('s1', 'c1', (data) => received.push(data));
        const handler = bridge.createStreamHandler('s1');
        handler({ type: 'text', content: 'hello' });
        expect(received).toHaveLength(1);
        expect(JSON.parse(received[0]).chunk.content).toBe('hello');
    });

    it('multiple subscribers', () => {
        let count = 0;
        bridge.subscribe('s1', 'c1', () => count++);
        bridge.subscribe('s1', 'c2', () => count++);
        bridge.createStreamHandler('s1')({ type: 'text', content: 'x' });
        expect(count).toBe(2);
    });

    it('unsubscribe stops delivery', () => {
        let count = 0;
        const unsub = bridge.subscribe('s1', 'c1', () => count++);
        unsub();
        bridge.createStreamHandler('s1')({ type: 'text', content: 'x' });
        expect(count).toBe(0);
    });

    it('getSubscriberCount', () => {
        bridge.subscribe('s1', 'c1', () => {});
        bridge.subscribe('s1', 'c2', () => {});
        expect(bridge.getSubscriberCount('s1')).toBe(2);
        expect(bridge.getSubscriberCount('s2')).toBe(0);
    });

    it('clear removes all', () => {
        bridge.subscribe('s1', 'c1', () => {});
        bridge.clear();
        expect(bridge.getSubscriberCount('s1')).toBe(0);
    });

    it('handles send errors gracefully', () => {
        bridge.subscribe('s1', 'c1', () => { throw new Error('disconnected'); });
        const handler = bridge.createStreamHandler('s1');
        expect(() => handler({ type: 'text', content: 'x' })).not.toThrow();
    });
});
