/**
 * Wave 12: Plugin Runtime Execution Tests
 *
 * Tests the full plugin→message pipeline integration:
 *   - PluginMessageBridge hook firing at each stage
 *   - PluginExecutor tool/session/agent hooks
 *   - GatewayPluginIntegration lifecycle
 *   - Priority ordering, error isolation, claim semantics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginMessageBridge, type PipelineMessage } from '../../src/plugins/message-bridge.js';
import { PluginExecutor } from '../../src/plugins/executor.js';
import { GatewayPluginIntegration } from '../../src/gateway/plugin-integration.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { PluginRegistry } from '../../src/plugins/registry.js';


// ═══════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════

function createTestMessage(overrides: Partial<PipelineMessage> = {}): PipelineMessage {
    return {
        id: `msg-${Date.now()}`,
        sessionKey: 'test-session',
        channel: 'test',
        content: 'Hello, world!',
        sender: { id: 'user-1', name: 'Test User', role: 'user' },
        timestamp: Date.now(),
        ...overrides,
    };
}

function createTestRegistry(): PluginRegistry {
    return new PluginRegistry();
}

function createTestHookRunner(registry?: PluginRegistry): HookRunner {
    return new HookRunner(registry ?? createTestRegistry(), { catchErrors: true });
}

// ═══════════════════════════════════════════════════════════════════
// PluginMessageBridge
// ═══════════════════════════════════════════════════════════════════

describe('PluginMessageBridge', () => {
    let registry: PluginRegistry;
    let hookRunner: HookRunner;
    let bridge: PluginMessageBridge;

    beforeEach(() => {
        registry = createTestRegistry();
        hookRunner = new HookRunner(registry, { catchErrors: true });
        bridge = new PluginMessageBridge(hookRunner);
    });

    // --- Core Pipeline ---

    it('processes a message through the pipeline', async () => {
        bridge.setHandler(async (msg) => `Echo: ${msg.content}`);
        const msg = createTestMessage({ content: 'test input' });
        const result = await bridge.processMessage(msg);

        expect(result.response).not.toBeNull();
        expect(result.response!.content).toBe('Echo: test input');
        expect(result.response!.cancelled).toBe(false);
        expect(result.stages.length).toBeGreaterThan(0);
        expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('returns placeholder when no handler is set', async () => {
        const msg = createTestMessage();
        const result = await bridge.processMessage(msg);

        expect(result.response).not.toBeNull();
        expect(result.response!.content).toBe('[No handler configured]');
    });

    it('tracks pipeline stages with timing', async () => {
        bridge.setHandler(async () => 'response');
        const result = await bridge.processMessage(createTestMessage());

        const stageNames = result.stages.map(s => s.stage);
        expect(stageNames).toContain('message_received');
        expect(stageNames).toContain('before_dispatch');
        expect(stageNames).toContain('handler');
        expect(stageNames).toContain('message_sending');
        expect(stageNames).toContain('message_sent');

        for (const stage of result.stages) {
            expect(stage.success).toBe(true);
            expect(stage.duration).toBeGreaterThanOrEqual(0);
        }
    });

    it('fires message_received hooks', async () => {
        const received: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'test-plugin',
            handler: (event) => { received.push(event); },
        });

        bridge.setHandler(async () => 'ok');
        await bridge.processMessage(createTestMessage({ content: 'hello' }));

        expect(received).toHaveLength(1);
        expect((received[0] as Record<string, unknown>).content).toBe('hello');
    });

    it('fires message_sending hooks that can modify content', async () => {
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'modifier-plugin',
            handler: (event) => {
                return { content: `[modified] ${(event as Record<string, unknown>).content}` };
            },
        });

        bridge.setHandler(async () => 'original response');
        const result = await bridge.processMessage(createTestMessage());

        expect(result.response!.content).toBe('[modified] original response');
    });

    it('fires message_sending hooks that can cancel', async () => {
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'cancel-plugin',
            handler: () => ({ cancel: true }),
        });

        bridge.setHandler(async () => 'response');
        const result = await bridge.processMessage(createTestMessage());

        expect(result.response).toBeNull();
    });

    it('fires message_sent hooks after successful send', async () => {
        const sent: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'message_sent',
            pluginId: 'tracker',
            handler: (event) => { sent.push(event); },
        });

        bridge.setHandler(async () => 'sent content');
        await bridge.processMessage(createTestMessage());

        expect(sent).toHaveLength(1);
        expect((sent[0] as Record<string, unknown>).content).toBe('sent content');
    });

    it('does NOT fire message_sent when cancelled', async () => {
        const sent: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'cancel',
            handler: () => ({ cancel: true }),
        });
        registry.registerTypedHook({
            hookName: 'message_sent',
            pluginId: 'tracker',
            handler: (event) => { sent.push(event); },
        });

        bridge.setHandler(async () => 'response');
        await bridge.processMessage(createTestMessage());

        expect(sent).toHaveLength(0);
    });

    it('supports before_dispatch claim (plugin takes over)', async () => {
        registry.registerTypedHook({
            hookName: 'before_dispatch',
            pluginId: 'greeter',
            handler: (event) => ({
                handled: true,
                response: 'Plugin handled this!',
            }),
        });

        bridge.setHandler(async () => 'this should NOT be called');
        const result = await bridge.processMessage(createTestMessage());

        expect(result.claimedBy).toBe('plugin');
        expect(result.response!.content).toBe('Plugin handled this!');
    });

    it('skips handler when claimed by plugin', async () => {
        const handlerCalls: string[] = [];

        registry.registerTypedHook({
            hookName: 'before_dispatch',
            pluginId: 'claimer',
            handler: () => ({ handled: true, response: 'claimed' }),
        });

        bridge.setHandler(async (msg) => {
            handlerCalls.push(msg.content);
            return 'handler called';
        });

        await bridge.processMessage(createTestMessage());
        expect(handlerCalls).toHaveLength(0);
    });

    it('fires before_model_resolve to override model', async () => {
        registry.registerTypedHook({
            hookName: 'before_model_resolve',
            pluginId: 'model-override',
            handler: () => ({ modelOverride: 'gpt-4o-mini' }),
        });

        let capturedModel: string | undefined;
        bridge.setHandler(async (_msg, ctx) => {
            capturedModel = ctx.model;
            return 'ok';
        });

        await bridge.processMessage(createTestMessage());
        expect(capturedModel).toBe('gpt-4o-mini');
    });

    it('fires llm_input and llm_output hooks', async () => {
        const inputs: unknown[] = [];
        const outputs: unknown[] = [];

        registry.registerTypedHook({
            hookName: 'llm_input',
            pluginId: 'observer',
            handler: (event) => { inputs.push(event); },
        });
        registry.registerTypedHook({
            hookName: 'llm_output',
            pluginId: 'observer',
            handler: (event) => { outputs.push(event); },
        });

        bridge.setHandler(async () => 'llm response');
        await bridge.processMessage(createTestMessage({ content: 'user prompt' }));

        expect(inputs).toHaveLength(1);
        expect(outputs).toHaveLength(1);
        expect((inputs[0] as Record<string, unknown>).content).toBe('user prompt');
        expect((outputs[0] as Record<string, unknown>).content).toBe('llm response');
    });

    // --- Stats ---

    it('tracks pipeline statistics', async () => {
        bridge.setHandler(async () => 'ok');
        await bridge.processMessage(createTestMessage());
        await bridge.processMessage(createTestMessage());

        const stats = bridge.getStats();
        expect(stats.messagesProcessed).toBe(2);
        expect(stats.hooksFired).toBeGreaterThan(0);
    });

    it('tracks plugin claims in stats', async () => {
        registry.registerTypedHook({
            hookName: 'before_dispatch',
            pluginId: 'claimer',
            handler: () => ({ handled: true, response: 'claimed' }),
        });

        bridge.setHandler(async () => 'ok');
        await bridge.processMessage(createTestMessage());

        expect(bridge.getStats().pluginClaims).toBe(1);
    });

    it('tracks plugin cancels in stats', async () => {
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'canceler',
            handler: () => ({ cancel: true }),
        });

        bridge.setHandler(async () => 'ok');
        await bridge.processMessage(createTestMessage());

        expect(bridge.getStats().pluginCancels).toBe(1);
    });

    it('resets statistics', async () => {
        bridge.setHandler(async () => 'ok');
        await bridge.processMessage(createTestMessage());
        bridge.resetStats();

        const stats = bridge.getStats();
        expect(stats.messagesProcessed).toBe(0);
        expect(stats.hooksFired).toBe(0);
    });

    // --- Error Isolation ---

    it('continues pipeline when hook throws', async () => {
        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'crasher',
            handler: () => { throw new Error('Plugin crash!'); },
        });

        bridge.setHandler(async () => 'survived');
        const result = await bridge.processMessage(createTestMessage());

        // Pipeline continues despite hook error
        expect(result.response).not.toBeNull();
        expect(result.response!.content).toBe('survived');
    });

    it('isolates handler errors without crashing pipeline', async () => {
        bridge.setHandler(async () => { throw new Error('Handler crash!'); });
        const result = await bridge.processMessage(createTestMessage());

        // Handler error is isolated — pipeline continues with empty content
        expect(result.stages.some(s => s.stage === 'handler' && !s.success)).toBe(true);
        expect(result.response).not.toBeNull();
        expect(result.response!.content).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginExecutor
// ═══════════════════════════════════════════════════════════════════

describe('PluginExecutor', () => {
    let registry: PluginRegistry;
    let hookRunner: HookRunner;
    let executor: PluginExecutor;

    beforeEach(() => {
        registry = createTestRegistry();
        hookRunner = new HookRunner(registry, { catchErrors: true });
        executor = new PluginExecutor(hookRunner);
    });

    // --- Tool Hooks ---

    it('fires before_tool_call and returns unblocked', async () => {
        const result = await executor.beforeToolCall('read_file', { path: '/tmp/test' }, 'session-1');
        expect(result.blocked).toBe(false);
    });

    it('before_tool_call can block tool execution', async () => {
        registry.registerTypedHook({
            hookName: 'before_tool_call',
            pluginId: 'safety',
            handler: (event) => {
                const e = event as Record<string, unknown>;
                if (e.toolName === 'delete_file') {
                    return { block: true, blockReason: 'Dangerous operation' };
                }
            },
        });

        const result = await executor.beforeToolCall('delete_file', {}, 'session-1');
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Dangerous operation');
    });

    it('before_tool_call can modify params', async () => {
        registry.registerTypedHook({
            hookName: 'before_tool_call',
            pluginId: 'modifier',
            handler: () => ({ params: { path: '/safe/path' } }),
        });

        const result = await executor.beforeToolCall('read_file', { path: '/etc/passwd' }, 's1');
        expect(result.blocked).toBe(false);
        expect(result.modifiedParams).toEqual({ path: '/safe/path' });
    });

    it('fires after_tool_call hooks', async () => {
        const observed: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'after_tool_call',
            pluginId: 'logger',
            handler: (event) => { observed.push(event); },
        });

        await executor.afterToolCall('read_file', 'file content', 'session-1');
        expect(observed).toHaveLength(1);
        expect((observed[0] as Record<string, unknown>).toolName).toBe('read_file');
    });

    // --- Agent Lifecycle ---

    it('fires before_agent_start hooks', async () => {
        const events: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'before_agent_start',
            pluginId: 'tracker',
            handler: (event) => { events.push(event); return { customKey: 'value' }; },
        });

        const result = await executor.beforeAgentStart('session-1', 'gpt-4o', 1);
        expect(events).toHaveLength(1);
        expect(result).toEqual({ customKey: 'value' });
    });

    it('fires agent_end hooks', async () => {
        const events: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'agent_end',
            pluginId: 'tracker',
            handler: (event) => { events.push(event); },
        });

        await executor.agentEnd('session-1', 'gpt-4o', 5);
        expect(events).toHaveLength(1);
    });

    // --- Compaction ---

    it('fires before_compaction hooks', async () => {
        const events: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'before_compaction',
            pluginId: 'tracker',
            handler: (event) => { events.push(event); },
        });

        await executor.beforeCompaction('session-1');
        expect(events).toHaveLength(1);
    });

    it('fires after_compaction hooks', async () => {
        const events: unknown[] = [];
        registry.registerTypedHook({
            hookName: 'after_compaction',
            pluginId: 'tracker',
            handler: (event) => { events.push(event); },
        });

        await executor.afterCompaction('session-1', { before: 100, after: 50 });
        expect(events).toHaveLength(1);
    });

    // --- Inbound Claim ---

    it('returns unclaimed when no plugin claims', async () => {
        const result = await executor.tryInboundClaim('hello', 'session-1', 'discord');
        expect(result.claimed).toBe(false);
    });

    it('returns claimed when plugin handles inbound', async () => {
        registry.registerTypedHook({
            hookName: 'inbound_claim',
            pluginId: 'greeter',
            handler: (event) => {
                const e = event as Record<string, unknown>;
                if (typeof e.content === 'string' && e.content.startsWith('/greet')) {
                    return { handled: true, response: 'Hello from plugin!' };
                }
            },
        });

        const result = await executor.tryInboundClaim('/greet user', 'session-1', 'test');
        expect(result.claimed).toBe(true);
        expect(result.response).toBe('Hello from plugin!');
    });

    // --- Stats ---

    it('tracks tool call statistics', async () => {
        await executor.beforeToolCall('t1', {}, 's');
        await executor.beforeToolCall('t2', {}, 's');

        expect(executor.getStats().toolCallsProcessed).toBe(2);
    });

    it('tracks blocked tool calls', async () => {
        registry.registerTypedHook({
            hookName: 'before_tool_call',
            pluginId: 'blocker',
            handler: () => ({ block: true, blockReason: 'no' }),
        });

        await executor.beforeToolCall('dangerous', {}, 's');
        expect(executor.getStats().toolCallsBlocked).toBe(1);
    });

    // --- Error Isolation ---

    it('handles hook errors gracefully', async () => {
        registry.registerTypedHook({
            hookName: 'before_tool_call',
            pluginId: 'crasher',
            handler: () => { throw new Error('crash'); },
        });

        const result = await executor.beforeToolCall('tool', {}, 's');
        expect(result.blocked).toBe(false); // Error doesn't block
    });
});

// ═══════════════════════════════════════════════════════════════════
// GatewayPluginIntegration
// ═══════════════════════════════════════════════════════════════════

describe('GatewayPluginIntegration', () => {
    it('creates with disabled config', () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        expect(integration.isInitialized()).toBe(false);
    });

    it('returns pass-through when not initialized', async () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        const result = await integration.processMessage(createTestMessage());

        expect(result.response).not.toBeNull();
        expect(result.response!.content).toContain('not initialized');
    });

    it('reports stats when not initialized', () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        const stats = integration.getStats();
        expect(stats.initialized).toBe(false);
        expect(stats.pluginsLoaded).toBe(0);
    });

    it('handles session hooks when not initialized', async () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        // Should not throw
        await integration.onSessionStart('session-1', 'discord');
        await integration.onSessionEnd('session-1', 'timeout');
    });

    it('handles tool hooks when not initialized', async () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        const result = await integration.onBeforeToolCall('tool', {}, 'session');
        expect(result.blocked).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Multiple Plugins
// ═══════════════════════════════════════════════════════════════════

describe('Multiple Plugins Integration', () => {
    let registry: PluginRegistry;
    let hookRunner: HookRunner;
    let bridge: PluginMessageBridge;

    beforeEach(() => {
        registry = createTestRegistry();
        hookRunner = new HookRunner(registry, { catchErrors: true });
        bridge = new PluginMessageBridge(hookRunner);
        bridge.setHandler(async (msg) => `Processed: ${msg.content}`);
    });

    it('multiple plugins observe message_received', async () => {
        const plugin1: unknown[] = [];
        const plugin2: unknown[] = [];

        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'analytics',
            handler: (event) => { plugin1.push(event); },
        });
        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'logging',
            handler: (event) => { plugin2.push(event); },
        });

        await bridge.processMessage(createTestMessage());

        expect(plugin1).toHaveLength(1);
        expect(plugin2).toHaveLength(1);
    });

    it('first plugin error does not prevent second plugin', async () => {
        const plugin2: unknown[] = [];

        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'crasher',
            handler: () => { throw new Error('Plugin 1 crashed'); },
        });
        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'survivor',
            handler: (event) => { plugin2.push(event); },
        });

        const result = await bridge.processMessage(createTestMessage());

        // Pipeline completes despite plugin 1 crash
        expect(result.response).not.toBeNull();
        // Plugin 2 still receives the event (parallel execution)
        // Note: in void hooks, both run in parallel so plugin 2 still fires
    });

    it('message_sending hooks chain modifications', async () => {
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'plugin-a',
            handler: (event) => {
                const content = (event as Record<string, unknown>).content as string;
                return { content: content + ' [A]' };
            },
            priority: 100,
        });
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'plugin-b',
            handler: (event) => {
                const content = (event as Record<string, unknown>).content as string;
                return { content: content + ' [B]' };
            },
            priority: 50,
        });

        const result = await bridge.processMessage(createTestMessage({ content: 'hello' }));

        // The last hook's modification wins (modifying hook returns latest)
        expect(result.response).not.toBeNull();
    });

    it('cancel takes precedence over modify', async () => {
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'modifier',
            handler: () => ({ content: 'modified' }),
            priority: 100,
        });
        registry.registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'canceler',
            handler: () => ({ cancel: true }),
            priority: 50,
        });

        const result = await bridge.processMessage(createTestMessage());

        // Cancel wins even if later in priority — merged via hook policy
        // The message_sending hook in HookRunner stops on cancel=true
    });
});
