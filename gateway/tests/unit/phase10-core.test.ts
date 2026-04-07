/**
 * CoreBlow Phase 10 — Deep Core Runtime Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRuntime, AgentSession } from '../../src/agents/runtime.js';
import type { ModelProvider } from '../../src/agents/runtime.js';
import { validateConfig, mergeConfigs, resolveEnvOverrides, validateFullConfig, AGENT_SCHEMA, SCHEMAS } from '../../src/config/validator.js';
import { GatewayServer } from '../../src/gateway/server.js';
import { CommandDispatcher } from '../../src/commands/dispatcher.js';

// === Mock Model Provider ===
function createMockProvider(): ModelProvider {
    return {
        id: 'mock',
        name: 'Mock Provider',
        chat: async (params) => ({
            content: `Mock response to: ${params.messages[params.messages.length - 1]?.content ?? ''}`,
            usage: { input: 10, output: 20, total: 30 },
            finishReason: 'stop',
        }),
    };
}

// ================================================================
// Agent Runtime Tests
// ================================================================
describe('AgentRuntime', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        runtime = new AgentRuntime();
    });

    it('should register a provider', () => {
        runtime.registerProvider(createMockProvider());
        // No crash = success
    });

    it('should create a session', () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', { model: 'test' });
        expect(session.id).toBe('s1');
    });

    it('should reject duplicate session IDs', () => {
        runtime.registerProvider(createMockProvider());
        runtime.createSession('s1', { model: 'test' });
        expect(() => runtime.createSession('s1', { model: 'test' })).toThrow('already exists');
    });

    it('should get an existing session', () => {
        runtime.registerProvider(createMockProvider());
        runtime.createSession('s1', { model: 'test' });
        expect(runtime.getSession('s1')).not.toBeNull();
        expect(runtime.getSession('nope')).toBeNull();
    });

    it('should destroy a session', () => {
        runtime.registerProvider(createMockProvider());
        runtime.createSession('s1', { model: 'test' });
        expect(runtime.destroySession('s1')).toBe(true);
        expect(runtime.getSession('s1')).toBeNull();
    });

    it('should list sessions', () => {
        runtime.registerProvider(createMockProvider());
        runtime.createSession('s1', { model: 'test' });
        runtime.createSession('s2', { model: 'test' });
        expect(runtime.listSessions()).toHaveLength(2);
    });

    it('should chat and get a response', async () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', { model: 'test' });
        const response = await session.chat('Hello!');
        expect(response).toContain('Mock response');
    });

    it('should track token usage', async () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', { model: 'test' });
        await session.chat('Hello!');
        const usage = session.getTokenUsage();
        expect(usage.total).toBe(30);
    });

    it('should track conversation messages', async () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', {
            model: 'test',
            systemPrompt: 'You are helpful.',
        });
        await session.chat('Hello!');
        const messages = session.getMessages();
        expect(messages.length).toBeGreaterThanOrEqual(3); // system + user + assistant
    });

    it('should check budget exceeded', () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', { model: 'test', tokenBudget: 100 });
        expect(session.isBudgetExceeded()).toBe(false);
    });

    it('should reset session', async () => {
        runtime.registerProvider(createMockProvider());
        const session = runtime.createSession('s1', {
            model: 'test',
            systemPrompt: 'System',
        });
        await session.chat('Hello');
        session.reset();
        expect(session.getMessages()).toHaveLength(1); // only system prompt
        expect(session.getTokenUsage().total).toBe(0);
    });
});

// ================================================================
// Config Validator Tests
// ================================================================
describe('Config Validator', () => {
    it('should validate a valid config', () => {
        const result = validateConfig({
            model: 'gpt-4o',
            temperature: 0.7,
        }, AGENT_SCHEMA);
        expect(result.valid).toBe(true);
    });

    it('should report missing required fields', () => {
        const result = validateConfig({}, AGENT_SCHEMA);
        // model is required
        expect(result.errors.some((e) => e.path.includes('model'))).toBe(true);
    });

    it('should apply defaults', () => {
        const result = validateConfig({ model: 'gpt-4o' }, AGENT_SCHEMA);
        expect(result.resolved['temperature']).toBe(0.7);
        expect(result.resolved['stream']).toBe(true);
    });

    it('should reject invalid types', () => {
        const result = validateConfig({
            model: 'gpt-4o',
            temperature: 'hot' as unknown as number,
        }, AGENT_SCHEMA);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toContain('number');
    });

    it('should enforce min/max constraints', () => {
        const result = validateConfig({
            model: 'gpt-4o',
            temperature: 5,
        }, AGENT_SCHEMA);
        expect(result.valid).toBe(false);
    });

    it('should merge configs with precedence', () => {
        const merged = mergeConfigs([
            { source: 'default', data: { a: 1, b: 2, nested: { x: 1 } } },
            { source: 'file', data: { b: 3 } },
            { source: 'override', data: { a: 99 } },
        ]);
        expect(merged['a']).toBe(99);
        expect(merged['b']).toBe(3);
    });

    it('should resolve env overrides', () => {
        process.env['CB_AGENTS_MODEL'] = 'claude-3-opus';
        const overrides = resolveEnvOverrides('CB');
        expect((overrides['agents'] as Record<string, unknown>)?.['model']).toBe('claude-3-opus');
        delete process.env['CB_AGENTS_MODEL'];
    });

    it('should parse env booleans and numbers', () => {
        process.env['CB_TEST_ENABLED'] = 'true';
        process.env['CB_TEST_COUNT'] = '42';
        const overrides = resolveEnvOverrides('CB');
        expect((overrides['test'] as Record<string, unknown>)?.['enabled']).toBe(true);
        expect((overrides['test'] as Record<string, unknown>)?.['count']).toBe(42);
        delete process.env['CB_TEST_ENABLED'];
        delete process.env['CB_TEST_COUNT'];
    });

    it('should validate full config across all schemas', () => {
        const result = validateFullConfig({
            agents: { model: 'gpt-4o' },
            security: { rateLimit: 200 },
        });
        expect(result.results['agents']!.valid).toBe(true);
    });

    it('should have built-in schemas for all modules', () => {
        expect(SCHEMAS['agents']).toBeDefined();
        expect(SCHEMAS['channels']).toBeDefined();
        expect(SCHEMAS['security']).toBeDefined();
        expect(SCHEMAS['providers']).toBeDefined();
    });
});

// ================================================================
// Gateway Server Tests
// ================================================================
describe('GatewayServer', () => {
    it('should create a server instance', () => {
        const server = new GatewayServer({ port: 49300 });
        expect(server).toBeTruthy();
    });

    it('should register custom routes', () => {
        const server = new GatewayServer({ port: 49301 });
        server.route('GET', '/custom', (_req, res) => {
            res.writeHead(200);
            res.end('ok');
        });
    });

    it('should add middleware', () => {
        const server = new GatewayServer({ port: 49302 });
        server.use(async (_req, _res, next) => { await next(); });
    });

    it('should get server info', () => {
        const server = new GatewayServer({ port: 49303 });
        const info = server.getInfo();
        expect(info.port).toBe(49303);
    });

    it('should start and stop', async () => {
        const server = new GatewayServer({ port: 49304, host: '127.0.0.1' });
        await server.start();
        const info = server.getInfo();
        expect(info.uptime).toBeGreaterThanOrEqual(0);
        await server.stop();
    });
});

// ================================================================
// Command Dispatcher Tests
// ================================================================
describe('CommandDispatcher', () => {
    let dispatcher: CommandDispatcher;

    beforeEach(() => {
        dispatcher = new CommandDispatcher();
    });

    it('should have built-in commands', () => {
        const cmds = dispatcher.listCommands();
        const names = cmds.map((c) => c.name);
        expect(names).toContain('help');
        expect(names).toContain('status');
        expect(names).toContain('model');
        expect(names).toContain('doctor');
        expect(names).toContain('reset');
        expect(names).toContain('clear');
        expect(names).toContain('tools');
        expect(names).toContain('agent');
    });

    it('should detect commands', () => {
        expect(dispatcher.isCommand('/help')).toBe(true);
        expect(dispatcher.isCommand('hello')).toBe(false);
    });

    it('should dispatch /help', async () => {
        const result = await dispatcher.dispatch('/help');
        expect(result.output).toContain('Available Commands');
    });

    it('should dispatch /status', async () => {
        const result = await dispatcher.dispatch('/status');
        expect(result.output).toContain('CoreBlow Status');
    });

    it('should dispatch /doctor', async () => {
        const result = await dispatcher.dispatch('/doctor');
        expect(result.output).toContain('System Diagnostics');
    });

    it('should handle unknown commands', async () => {
        const result = await dispatcher.dispatch('/nonexistent');
        expect(result.error).toContain('Unknown command');
    });

    it('should resolve aliases', async () => {
        const result = await dispatcher.dispatch('/h');
        expect(result.output).toContain('Available Commands');
    });

    it('should parse flags', async () => {
        let capturedFlags: Record<string, unknown> = {};
        dispatcher.register({
            name: 'test',
            description: 'Test',
            handler: async (ctx) => {
                capturedFlags = ctx.flags;
                return 'ok';
            },
        });
        await dispatcher.dispatch('/test --verbose --format=json');
        expect(capturedFlags['verbose']).toBe(true);
        expect(capturedFlags['format']).toBe('json');
    });

    it('should enforce owner-only commands', async () => {
        dispatcher.register({
            name: 'admin',
            description: 'Admin only',
            ownerOnly: true,
            handler: async () => 'secret',
        });
        const result = await dispatcher.dispatch('/admin', { isOwner: false });
        expect(result.error).toContain('owner privileges');
    });

    it('should allow owner to run owner-only commands', async () => {
        dispatcher.register({
            name: 'admin2',
            description: 'Admin only',
            ownerOnly: true,
            handler: async () => 'secret data',
        });
        const result = await dispatcher.dispatch('/admin2', { isOwner: true });
        expect(result.output).toBe('secret data');
    });

    it('should track command history', async () => {
        await dispatcher.dispatch('/help');
        await dispatcher.dispatch('/status');
        const history = dispatcher.getHistory();
        expect(history).toHaveLength(2);
    });

    it('should run middleware', async () => {
        let middlewareRan = false;
        dispatcher.use(async (_ctx, next) => {
            middlewareRan = true;
            await next();
        });
        await dispatcher.dispatch('/help');
        expect(middlewareRan).toBe(true);
    });

    it('should handle empty commands', async () => {
        const result = await dispatcher.dispatch('/');
        expect(result.error).toBeTruthy();
    });
});
