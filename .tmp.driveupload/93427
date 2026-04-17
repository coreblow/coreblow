/**
 * Wave 13: E2E Gateway Tests
 *
 * Full end-to-end tests that boot the gateway → load plugins →
 * process messages → verify output. Tests the complete integrated
 * system as a user would experience it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Gateway core
import { WsHandler } from '../../src/gateway/ws-handler.js';
import { MiddlewareChain, type MiddlewareContext } from '../../src/gateway/middleware-chain.js';
import { CircuitBreaker } from '../../src/gateway/circuit-breaker.js';

// Plugin system
import { PluginLoader } from '../../src/plugins/plugin-loader.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { PluginRuntime } from '../../src/plugins/runtime.js';
import { PluginMessageBridge, type PipelineMessage } from '../../src/plugins/message-bridge.js';
import { PluginExecutor } from '../../src/plugins/executor.js';
import { GatewayPluginIntegration } from '../../src/gateway/plugin-integration.js';

// Commands
import { CommandRegistry } from '../../src/commands/registry.js';
import { getBuiltinCommands } from '../../src/commands/builtins.js';

// Session
import { SessionPersistenceManager } from '../../src/agents/session-persistence.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createTestMessage(overrides: Partial<PipelineMessage> = {}): PipelineMessage {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sessionKey: 'e2e-session-1',
        channel: 'test',
        content: 'Hello from E2E',
        sender: { id: 'e2e-user', name: 'E2E Tester', role: 'user' },
        timestamp: Date.now(),
        ...overrides,
    };
}

function createPluginDir(baseDir: string, name: string, manifest: Record<string, unknown> = {}): string {
    const pluginDir = path.join(baseDir, name);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ name, version: '1.0.0', description: `E2E plugin: ${name}`, ...manifest }),
    );
    fs.writeFileSync(path.join(pluginDir, 'src', 'index.ts'), `export default { activate: async () => {} };`);
    return pluginDir;
}

function createMiddlewareContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
    return {
        request: { method: 'GET', path: '/', headers: {} },
        response: { status: 200, body: null, headers: {} },
        state: {},
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════════
// E2E: Full Gateway Boot → Message Processing
// ═══════════════════════════════════════════════════════════════════

describe('E2E: Gateway Boot → Plugin → Message', () => {
    let tmpDir: string;
    let pluginsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-gw-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('boots gateway → discovers plugins → processes message → shuts down', async () => {
        createPluginDir(pluginsDir, 'logger');
        createPluginDir(pluginsDir, 'analytics');

        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        const loadResult = await loader.loadAll();
        expect(loadResult.loaded).toBe(2);
        expect(loader.getState()).toBe('loaded');

        const hookRunner = loader.getHookRunner();
        const bridge = new PluginMessageBridge(hookRunner);
        bridge.setHandler(async (msg) => `Gateway received: ${msg.content}`);

        const msg = createTestMessage({ content: 'Hello Gateway!' });
        const result = await bridge.processMessage(msg);

        expect(result.response).not.toBeNull();
        expect(result.response!.content).toBe('Gateway received: Hello Gateway!');
        expect(result.stages.length).toBeGreaterThan(0);
        expect(bridge.getStats().messagesProcessed).toBe(1);

        await loader.shutdown();
        expect(loader.getState()).toBe('stopped');
    });

    it('plugin hooks fire during message processing', async () => {
        createPluginDir(pluginsDir, 'hook-test');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const registry = loader.getRegistry();
        const received: string[] = [];
        const sent: string[] = [];

        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'hook-test',
            handler: (event) => { received.push((event as Record<string, unknown>).content as string); },
        });
        registry.registerTypedHook({
            hookName: 'message_sent',
            pluginId: 'hook-test',
            handler: (event) => { sent.push((event as Record<string, unknown>).content as string); },
        });

        const bridge = new PluginMessageBridge(loader.getHookRunner());
        bridge.setHandler(async (msg) => `Processed: ${msg.content}`);
        await bridge.processMessage(createTestMessage({ content: 'test hook' }));

        expect(received).toEqual(['test hook']);
        expect(sent).toEqual(['Processed: test hook']);
        await loader.shutdown();
    });

    it('plugin claims message before handler', async () => {
        createPluginDir(pluginsDir, 'claimer');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        loader.getRegistry().registerTypedHook({
            hookName: 'before_dispatch',
            pluginId: 'claimer',
            handler: (event) => {
                const e = event as Record<string, unknown>;
                if ((e.content as string).startsWith('!custom')) {
                    return { handled: true, response: 'Custom plugin response' };
                }
            },
        });

        const bridge = new PluginMessageBridge(loader.getHookRunner());
        let handlerCalled = false;
        bridge.setHandler(async () => { handlerCalled = true; return 'default'; });

        const result = await bridge.processMessage(createTestMessage({ content: '!custom command' }));
        expect(result.claimedBy).toBe('plugin');
        expect(result.response!.content).toBe('Custom plugin response');
        expect(handlerCalled).toBe(false);
        await loader.shutdown();
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: GatewayPluginIntegration Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('E2E: GatewayPluginIntegration Lifecycle', () => {
    let tmpDir: string;
    let pluginsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-int-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('init → process → session hooks → tool hooks → shutdown', async () => {
        createPluginDir(pluginsDir, 'lifecycle-test');

        const integration = new GatewayPluginIntegration({
            enabled: true,
            loaderOptions: { pluginPaths: [pluginsDir] },
            lifecycleHooks: true,
        });

        const result = await integration.initPlugins();
        expect(result).not.toBeNull();
        expect(result!.loaded).toBe(1);
        expect(integration.isInitialized()).toBe(true);

        integration.setMessageHandler(async (msg) => `Hello ${msg.sender.name}`);
        const pResult = await integration.processMessage(createTestMessage());
        expect(pResult.response).not.toBeNull();
        expect(pResult.response!.content).toBe('Hello E2E Tester');

        await integration.onSessionStart('session-1', 'discord');
        await integration.onSessionEnd('session-1', 'timeout');

        const toolResult = await integration.onBeforeToolCall('read_file', { path: '/tmp' }, 'session-1');
        expect(toolResult.blocked).toBe(false);
        await integration.onAfterToolCall('read_file', 'contents', 'session-1');

        const stats = integration.getStats();
        expect(stats.initialized).toBe(true);
        expect(stats.pluginsLoaded).toBe(1);

        await integration.shutdownPlugins();
        expect(integration.isInitialized()).toBe(false);
    });

    it('handles disabled plugin system gracefully', async () => {
        const integration = new GatewayPluginIntegration({ enabled: false });
        const result = await integration.initPlugins();
        expect(result).toBeNull();
        expect(integration.isInitialized()).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: WsHandler Method Dispatch
// ═══════════════════════════════════════════════════════════════════

describe('E2E: WsHandler', () => {
    let wsHandler: WsHandler;

    beforeEach(() => { wsHandler = new WsHandler(); });
    afterEach(() => { wsHandler.closeAll(); });

    function mockWs() {
        const sent: string[] = [];
        let closed = false;
        let msgHandler: ((d: string) => void) | null = null;
        let closeHandler: (() => void) | null = null;
        return {
            sent,
            get closed() { return closed; },
            ws: { send: (d: string) => { sent.push(d); }, close: () => { closed = true; closeHandler?.(); } },
            onMsg: (h: (d: string) => void) => { msgHandler = h; },
            onClose: (h: () => void) => { closeHandler = h; },
            trigger: (d: string) => { msgHandler?.(d); },
        };
    }

    it('handles connect → method call → response', async () => {
        wsHandler.registerMethod('echo', async (_client, params) => ({ echo: params.text }));
        const mock = mockWs();
        const client = wsHandler.onConnect(mock.ws, mock.onMsg, mock.onClose);
        expect(client.id).toBeDefined();

        mock.trigger(JSON.stringify({ method: 'echo', id: 'req-1', params: { text: 'hello' } }));
        await new Promise(r => setTimeout(r, 10));

        expect(mock.sent.length).toBeGreaterThan(0);
        const response = JSON.parse(mock.sent[mock.sent.length - 1]);
        expect(response.id).toBe('req-1');
        expect(response.result.echo).toBe('hello');
    });

    it('handles ping/pong', async () => {
        const mock = mockWs();
        wsHandler.onConnect(mock.ws, mock.onMsg, mock.onClose);
        mock.trigger(JSON.stringify({ method: 'ping', id: 'p1' }));
        await new Promise(r => setTimeout(r, 10));

        const response = JSON.parse(mock.sent[mock.sent.length - 1]);
        expect(response.result.pong).toBe(true);
    });

    it('returns error for unknown method', async () => {
        const mock = mockWs();
        wsHandler.onConnect(mock.ws, mock.onMsg, mock.onClose);
        mock.trigger(JSON.stringify({ method: 'nonexistent', id: 'e1' }));
        await new Promise(r => setTimeout(r, 10));

        const response = JSON.parse(mock.sent[mock.sent.length - 1]);
        expect(response.error.code).toBe('UNKNOWN_METHOD');
    });

    it('returns error for invalid JSON', async () => {
        const mock = mockWs();
        wsHandler.onConnect(mock.ws, mock.onMsg, mock.onClose);
        mock.trigger('not json at all');
        await new Promise(r => setTimeout(r, 10));

        const response = JSON.parse(mock.sent[mock.sent.length - 1]);
        expect(response.error.code).toBe('PARSE_ERROR');
    });

    it('tracks client count', () => {
        const m1 = mockWs(), m2 = mockWs();
        wsHandler.onConnect(m1.ws, m1.onMsg, m1.onClose);
        wsHandler.onConnect(m2.ws, m2.onMsg, m2.onClose);
        expect(wsHandler.getClientCount()).toBe(2);
    });

    it('broadcasts to all clients', () => {
        const m1 = mockWs(), m2 = mockWs();
        wsHandler.onConnect(m1.ws, m1.onMsg, m1.onClose);
        wsHandler.onConnect(m2.ws, m2.onMsg, m2.onClose);
        wsHandler.broadcast('test-event', { hello: 'world' });

        expect(m1.sent.length).toBe(1);
        expect(m2.sent.length).toBe(1);
        const payload = JSON.parse(m1.sent[0]);
        expect(payload.event).toBe('test-event');
    });

    it('removes clients on disconnect', () => {
        const mock = mockWs();
        wsHandler.onConnect(mock.ws, mock.onMsg, mock.onClose);
        expect(wsHandler.getClientCount()).toBe(1);
        mock.ws.close();
        expect(wsHandler.getClientCount()).toBe(0);
    });

    it('closes all on shutdown', () => {
        const m1 = mockWs(), m2 = mockWs();
        wsHandler.onConnect(m1.ws, m1.onMsg, m1.onClose);
        wsHandler.onConnect(m2.ws, m2.onMsg, m2.onClose);
        wsHandler.closeAll('shutdown');
        expect(wsHandler.getClientCount()).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: MiddlewareChain
// ═══════════════════════════════════════════════════════════════════

describe('E2E: MiddlewareChain', () => {
    it('executes middleware in order', async () => {
        const chain = new MiddlewareChain();
        const order: string[] = [];

        chain.use('A', async (ctx, next) => { order.push('A'); await next(); order.push('A-after'); });
        chain.use('B', async (ctx, next) => { order.push('B'); await next(); order.push('B-after'); });
        chain.use('C', async (ctx, next) => { order.push('C'); await next(); });

        await chain.execute(createMiddlewareContext());
        expect(order).toEqual(['A', 'B', 'C', 'B-after', 'A-after']);
    });

    it('stops chain when middleware does not call next', async () => {
        const chain = new MiddlewareChain();
        const order: string[] = [];

        chain.use('A', async (_ctx, next) => { order.push('A'); await next(); });
        chain.use('B', async () => { order.push('B-stop'); });
        chain.use('C', async (_ctx, next) => { order.push('C'); await next(); });

        await chain.execute(createMiddlewareContext());
        expect(order).toEqual(['A', 'B-stop']);
        expect(order).not.toContain('C');
    });

    it('handles middleware errors by setting status 500', async () => {
        const chain = new MiddlewareChain();
        chain.use('crasher', async () => { throw new Error('middleware crash'); });

        const ctx = createMiddlewareContext();
        await chain.execute(ctx);
        expect(ctx.response.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: CircuitBreaker
// ═══════════════════════════════════════════════════════════════════

describe('E2E: CircuitBreaker', () => {
    it('starts closed and allows requests', async () => {
        const cb = new CircuitBreaker('test', { threshold: 3 });
        const result = await cb.execute(async () => 'success');
        expect(result).toBe('success');
        expect(cb.getState()).toBe('closed');
    });

    it('opens after threshold failures', async () => {
        const cb = new CircuitBreaker('test-open', { threshold: 3, slidingWindowMs: 60_000 });

        for (let i = 0; i < 3; i++) {
            try { await cb.execute(async () => { throw new Error('fail'); }); } catch { /* expected */ }
        }

        expect(cb.getState()).toBe('open');
    });

    it('rejects requests when open', async () => {
        const cb = new CircuitBreaker('test-reject', { threshold: 2, resetMs: 10_000 });

        for (let i = 0; i < 2; i++) {
            try { await cb.execute(async () => { throw new Error('fail'); }); } catch { /* open it */ }
        }
        expect(cb.getState()).toBe('open');

        await expect(cb.execute(async () => 'ok')).rejects.toThrow();
    });

    it('transitions to half-open after timeout', async () => {
        const cb = new CircuitBreaker('test-halfopen', { threshold: 2, resetMs: 50 });

        for (let i = 0; i < 2; i++) {
            try { await cb.execute(async () => { throw new Error('fail'); }); } catch { /* open it */ }
        }
        expect(cb.getState()).toBe('open');

        await new Promise(r => setTimeout(r, 60));
        const result = await cb.execute(async () => 'recovered');
        expect(result).toBe('recovered');
    });

    it('reports stats', () => {
        const cb = new CircuitBreaker('test-stats', { threshold: 5 });
        const stats = cb.getStats();
        expect(stats.state).toBe('closed');
        expect(stats.failures).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: CommandRegistry + Builtins
// ═══════════════════════════════════════════════════════════════════

describe('E2E: CommandRegistry', () => {
    let registry: CommandRegistry;

    beforeEach(() => {
        registry = new CommandRegistry('/');
        for (const cmd of getBuiltinCommands()) {
            registry.register(cmd);
        }
    });

    it('detects commands with prefix', () => {
        expect(registry.isCommand('/help')).toBe(true);
        expect(registry.isCommand('/status')).toBe(true);
        expect(registry.isCommand('hello')).toBe(false);
    });

    it('executes /help command', async () => {
        const result = await registry.run('/help', {
            senderId: 'user', senderName: 'User', sessionId: 'session-1',
            channel: 'test', reply: async () => {}, metadata: {},
        });
        expect(result).toBeDefined();
        expect(result?.output).toBeDefined();
    });

    it('returns error for unknown command', async () => {
        const result = await registry.run('/nonexistent', {
            senderId: 'user', senderName: 'User', sessionId: 'session-1',
            channel: 'test', reply: async () => {}, metadata: {},
        });
        expect(result?.error).toBeDefined();
    });

    it('reports stats', () => {
        const stats = registry.getStats();
        expect(stats.totalCommands).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Session Persistence
// ═══════════════════════════════════════════════════════════════════

describe('E2E: SessionPersistence', () => {
    let manager: SessionPersistenceManager;

    beforeEach(() => {
        manager = new SessionPersistenceManager({ defaultTtlMs: 5000, maxSessions: 10 });
    });

    afterEach(() => { manager.stopCleanup(); });

    it('creates and retrieves sessions', () => {
        const session = manager.getOrCreate('s1', { channel: 'test', userId: 'u1' });
        expect(session).toBeDefined();
        expect(session.id).toBe('s1');
    });

    it('appends messages to session', () => {
        manager.getOrCreate('s1', { channel: 'test', userId: 'u1' });
        manager.appendMessage('s1', { role: 'user', content: 'hello' });
        manager.appendMessage('s1', { role: 'assistant', content: 'hi' });
        const messages = manager.getMessages('s1');
        expect(messages).toHaveLength(2);
    });

    it('tracks multiple sessions', () => {
        manager.getOrCreate('s1', { channel: 'test', userId: 'u1' });
        manager.getOrCreate('s2', { channel: 'discord', userId: 'u2' });
        manager.getOrCreate('s3', { channel: 'telegram', userId: 'u3' });
        expect(manager.getStats().total).toBe(3);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: PluginRuntime Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('E2E: PluginRuntime', () => {
    let tmpDir: string;
    let runtime: PluginRuntime;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-rt-'));
        runtime = new PluginRuntime();
    });

    afterEach(async () => {
        await runtime.unloadAll();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('discovers plugins from directory', async () => {
        const pluginDir = path.join(tmpDir, 'test-plugin');
        fs.mkdirSync(pluginDir, { recursive: true });
        fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
            id: 'test-plugin', name: 'Test', version: '1.0.0', main: 'index.js',
        }));
        fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {};');

        const discovered = await runtime.discover(tmpDir);
        expect(discovered).toContain('test-plugin');
    });

    it('lists plugins', async () => {
        const pluginDir = path.join(tmpDir, 'lister');
        fs.mkdirSync(pluginDir, { recursive: true });
        fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
            id: 'lister', name: 'Lister', version: '2.0.0', main: 'index.js',
        }));
        fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {};');

        await runtime.discover(tmpDir);
        const plugins = runtime.listPlugins();
        expect(plugins).toHaveLength(1);
        expect(plugins[0].manifest.id).toBe('lister');
    });

    it('enables and disables plugins', async () => {
        const pluginDir = path.join(tmpDir, 'toggleable');
        fs.mkdirSync(pluginDir, { recursive: true });
        fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
            id: 'toggleable', name: 'Toggleable', version: '1.0.0', main: 'index.js',
        }));
        fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {};');

        await runtime.discover(tmpDir);
        expect(runtime.getPlugin('toggleable')!.enabled).toBe(true);
        runtime.setEnabled('toggleable', false);
        expect(runtime.getPlugin('toggleable')!.enabled).toBe(false);
        runtime.setEnabled('toggleable', true);
        expect(runtime.getPlugin('toggleable')!.enabled).toBe(true);
    });

    it('installs and uninstalls plugin', async () => {
        const pluginDir = path.join(tmpDir, 'lifecycle');
        fs.mkdirSync(pluginDir, { recursive: true });
        fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
            id: 'lifecycle', name: 'Lifecycle', version: '1.0.0', main: 'index.js',
        }));
        fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {};');

        const id = await runtime.install(pluginDir);
        expect(id).toBe('lifecycle');
        expect(runtime.getPlugin('lifecycle')).not.toBeNull();

        const ok = await runtime.uninstall('lifecycle');
        expect(ok).toBe(true);
        expect(runtime.getPlugin('lifecycle')).toBeNull();
    });

    it('handles non-existent directory gracefully', async () => {
        const discovered = await runtime.discover('/nonexistent/path');
        expect(discovered).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Full Stack — Plugin + Bridge + Executor
// ═══════════════════════════════════════════════════════════════════

describe('E2E: Full Stack Integration', () => {
    let tmpDir: string;
    let pluginsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('plugins + bridge + content filter pipeline', async () => {
        createPluginDir(pluginsDir, 'content-filter');
        createPluginDir(pluginsDir, 'rate-limiter');

        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        const loadResult = await loader.loadAll();
        expect(loadResult.loaded).toBe(2);

        const bridge = new PluginMessageBridge(loader.getHookRunner());
        bridge.setHandler(async (msg) => `AI says: ${msg.content.toUpperCase()}`);

        loader.getRegistry().registerTypedHook({
            hookName: 'message_sending',
            pluginId: 'content-filter',
            handler: (event) => {
                const content = (event as Record<string, unknown>).content as string;
                return { content: content.replace(/BADWORD/gi, '***') };
            },
        });

        const msg1 = await bridge.processMessage(createTestMessage({ content: 'hello world' }));
        expect(msg1.response!.content).toBe('AI says: HELLO WORLD');

        const msg2 = await bridge.processMessage(createTestMessage({ content: 'test BADWORD here' }));
        expect(msg2.response!.content).toBe('AI says: TEST *** HERE');

        expect(bridge.getStats().messagesProcessed).toBe(2);
        await loader.shutdown();
    });

    it('tool execution with plugin blocking', async () => {
        createPluginDir(pluginsDir, 'safety');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const executor = new PluginExecutor(loader.getHookRunner());
        loader.getRegistry().registerTypedHook({
            hookName: 'before_tool_call',
            pluginId: 'safety',
            handler: (event) => {
                const e = event as Record<string, unknown>;
                if (['rm', 'delete', 'format'].some(d => (e.toolName as string).includes(d))) {
                    return { block: true, blockReason: 'Dangerous tool blocked by safety plugin' };
                }
            },
        });

        const safe = await executor.beforeToolCall('read_file', { path: '/tmp/test' }, 'session');
        expect(safe.blocked).toBe(false);

        const blocked = await executor.beforeToolCall('delete_file', { path: '/' }, 'session');
        expect(blocked.blocked).toBe(true);
        expect(blocked.reason).toContain('safety plugin');

        await loader.shutdown();
    });

    it('session lifecycle with hooks', async () => {
        createPluginDir(pluginsDir, 'session-tracker');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const sessions: string[] = [];
        loader.getRegistry().registerTypedHook({
            hookName: 'session_start',
            pluginId: 'session-tracker',
            handler: (event) => { sessions.push(`start:${(event as Record<string, unknown>).sessionKey}`); },
        });
        loader.getRegistry().registerTypedHook({
            hookName: 'session_end',
            pluginId: 'session-tracker',
            handler: (event) => { sessions.push(`end:${(event as Record<string, unknown>).sessionKey}`); },
        });

        const hookRunner = loader.getHookRunner();
        await hookRunner.runSessionStart({ sessionKey: 'user-1', channel: 'discord', timestamp: Date.now() }, {});
        await hookRunner.runSessionEnd({ sessionKey: 'user-1', reason: 'timeout', timestamp: Date.now() }, {});

        expect(sessions).toEqual(['start:user-1', 'end:user-1']);
        await loader.shutdown();
    });
});
