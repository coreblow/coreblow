/**
 * Wave 4 — Plugin SDK Tests
 *
 * Tests for: plugin-sdk/sdk.ts, hooks-api.ts, config-builder.ts, testing.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { definePlugin, defineCommand, defineTool, defineHook, defineProvider } from '../../src/plugin-sdk/sdk.js';
import { HooksAPI } from '../../src/plugin-sdk/hooks-api.js';
import { ConfigBuilder } from '../../src/plugin-sdk/config-builder.js';
import {
    createMockContext,
    createMockLogger,
    createMockEventBus,
    createMockApi,
    TestPluginHarness,
} from '../../src/plugin-sdk/testing.js';

// ═══════════════════════════════════════════════════════════════════
// definePlugin SDK
// ═══════════════════════════════════════════════════════════════════

describe('Plugin SDK', () => {
    describe('definePlugin', () => {
        it('should create a plugin with defaults', () => {
            const plugin = definePlugin({});
            expect(plugin.commands).toEqual([]);
            expect(plugin.hooks).toEqual([]);
            expect(plugin.tools).toEqual([]);
            expect(plugin.providers).toEqual([]);
        });

        it('should preserve activate/deactivate', () => {
            const activate = async () => {};
            const plugin = definePlugin({ activate });
            expect(plugin.activate).toBe(activate);
        });

        it('should include provided commands', () => {
            const cmd = defineCommand('test', 'Test cmd', async () => 'ok');
            const plugin = definePlugin({ commands: [cmd] });
            expect(plugin.commands).toHaveLength(1);
            expect(plugin.commands[0]!.name).toBe('test');
        });
    });

    describe('defineCommand', () => {
        it('should create a command', () => {
            const cmd = defineCommand('hello', 'Say hello', async () => 'hi');
            expect(cmd.name).toBe('hello');
            expect(cmd.description).toBe('Say hello');
        });

        it('should execute the handler', async () => {
            const cmd = defineCommand('echo', 'Echo', async (args) => args.join(' '));
            const result = await cmd.handler(['a', 'b']);
            expect(result).toBe('a b');
        });
    });

    describe('defineTool', () => {
        it('should create a tool', () => {
            const tool = defineTool('search', 'Web search', { query: { type: 'string' } }, async () => 'results');
            expect(tool.name).toBe('search');
            expect(tool.parameters).toHaveProperty('query');
        });
    });

    describe('defineHook', () => {
        it('should create a hook with default priority', () => {
            const hook = defineHook('message_received', async () => {});
            expect(hook.event).toBe('message_received');
            expect(hook.priority).toBe(50);
        });

        it('should accept custom priority', () => {
            const hook = defineHook('session_start', async () => {}, 100);
            expect(hook.priority).toBe(100);
        });
    });

    describe('defineProvider', () => {
        it('should create a provider', () => {
            const provider = defineProvider('my-llm', ['model-a'], async () => ({}));
            expect(provider.name).toBe('my-llm');
            expect(provider.models).toEqual(['model-a']);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// HooksAPI
// ═══════════════════════════════════════════════════════════════════

describe('HooksAPI', () => {
    let api: HooksAPI;

    beforeEach(() => {
        api = new HooksAPI();
    });

    it('should register hooks fluently', () => {
        api.on('event1', async () => {}).on('event2', async () => {});
        expect(api.count()).toBe(2);
    });

    it('should register named hooks', () => {
        api.onMessageReceived(async () => {});
        api.onSessionStart(async () => {});
        api.onBeforeToolCall(async () => {});
        expect(api.count()).toBe(3);
    });

    it('should wrap before/after pairs', () => {
        const pair = api.wrap('before_tool_call', 'after_tool_call', {
            before: async () => {},
            after: async () => {},
        });
        expect(pair.before.event).toBe('before_tool_call');
        expect(pair.after.event).toBe('after_tool_call');
        expect(api.count()).toBe(2);
    });

    it('should sort by priority', () => {
        api.on('e', async () => 'low', { priority: 10 });
        api.on('e', async () => 'high', { priority: 100 });
        const sorted = api.getSortedHooks();
        expect(sorted[0]!.priority).toBe(100);
    });

    it('should clear hooks', () => {
        api.on('e', async () => {});
        api.clear();
        expect(api.count()).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// ConfigBuilder
// ═══════════════════════════════════════════════════════════════════

describe('ConfigBuilder', () => {
    it('should build a schema with string fields', () => {
        const schema = new ConfigBuilder()
            .string('apiKey', { required: true, sensitive: true, label: 'API Key' })
            .build();
        expect(schema.validate).toBeDefined();
        expect(schema.uiHints?.apiKey?.sensitive).toBe(true);
    });

    it('should validate required fields', () => {
        const schema = new ConfigBuilder()
            .string('name', { required: true })
            .build();
        const result = schema.validate!({}) as any;
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toContain('required');
    });

    it('should pass valid configs', () => {
        const schema = new ConfigBuilder()
            .string('name', { required: true })
            .number('retries', { default: 3 })
            .build();
        const result = schema.validate!({ name: 'test', retries: 5 });
        expect(result.ok).toBe(true);
    });

    it('should validate types', () => {
        const schema = new ConfigBuilder()
            .number('port')
            .build();
        const result = schema.validate!({ port: 'not-a-number' });
        expect(result.ok).toBe(false);
    });

    it('should validate enums', () => {
        const schema = new ConfigBuilder()
            .string('level', { enum: ['debug', 'info', 'error'] })
            .build();
        expect(schema.validate!({ level: 'info' }).ok).toBe(true);
        expect(schema.validate!({ level: 'invalid' }).ok).toBe(false);
    });

    it('should validate number min/max', () => {
        const schema = new ConfigBuilder()
            .number('port', { min: 1, max: 65535 })
            .build();
        expect(schema.validate!({ port: 8080 }).ok).toBe(true);
        expect(schema.validate!({ port: 0 }).ok).toBe(false);
        expect(schema.validate!({ port: 99999 }).ok).toBe(false);
    });

    it('should support boolean fields', () => {
        const schema = new ConfigBuilder()
            .boolean('debug', { default: false })
            .build();
        expect(schema.validate!({ debug: true }).ok).toBe(true);
        expect(schema.validate!({ debug: 'yes' }).ok).toBe(false);
    });

    it('should support array fields', () => {
        const schema = new ConfigBuilder()
            .array('tags', { default: [] })
            .build();
        expect(schema.validate!({ tags: ['a', 'b'] }).ok).toBe(true);
        expect(schema.validate!({ tags: 'not-array' }).ok).toBe(false);
    });

    it('should generate JSON schema', () => {
        const schema = new ConfigBuilder()
            .string('name', { required: true })
            .number('count')
            .build();
        expect(schema.jsonSchema).toBeDefined();
        expect((schema.jsonSchema as any).type).toBe('object');
        expect((schema.jsonSchema as any).required).toContain('name');
    });

    it('should get defaults', () => {
        const builder = new ConfigBuilder()
            .string('host', { default: 'localhost' })
            .number('port', { default: 3000 });
        expect(builder.getDefaults()).toEqual({ host: 'localhost', port: 3000 });
    });
});

// ═══════════════════════════════════════════════════════════════════
// Testing Utilities
// ═══════════════════════════════════════════════════════════════════

describe('Plugin Testing Utils', () => {
    describe('createMockContext', () => {
        it('should create a default context', () => {
            const ctx = createMockContext();
            expect(ctx.pluginId).toBe('test-plugin');
            expect(ctx.log).toBeDefined();
            expect(ctx.events).toBeDefined();
            expect(ctx.api).toBeDefined();
        });

        it('should accept overrides', () => {
            const ctx = createMockContext({ pluginId: 'custom', config: { key: 'val' } });
            expect(ctx.pluginId).toBe('custom');
            expect(ctx.config.key).toBe('val');
        });
    });

    describe('createMockLogger', () => {
        it('should record log calls', () => {
            const logger = createMockLogger();
            logger.info('hello');
            logger.error('boom');
            expect(logger.calls).toHaveLength(2);
            expect(logger.calls[0]!.level).toBe('info');
            expect(logger.calls[1]!.msg).toBe('boom');
        });
    });

    describe('createMockEventBus', () => {
        it('should record emissions', () => {
            const bus = createMockEventBus();
            bus.emit('test', { data: 42 });
            expect(bus.emitted).toHaveLength(1);
            expect(bus.emitted[0]!.event).toBe('test');
        });

        it('should call registered handlers', () => {
            const bus = createMockEventBus();
            let received: unknown;
            bus.on('test', (data) => { received = data; });
            bus.emit('test', 'hello');
            expect(received).toBe('hello');
        });

        it('should unregister handlers', () => {
            const bus = createMockEventBus();
            let count = 0;
            const handler = () => { count++; };
            bus.on('test', handler);
            bus.emit('test');
            bus.off('test', handler);
            bus.emit('test');
            expect(count).toBe(1);
        });
    });

    describe('createMockApi', () => {
        it('should record tool registrations', () => {
            const api = createMockApi();
            api.registerTool({ name: 'search', description: '', parameters: {}, execute: async () => '' });
            expect(api.registeredTools).toHaveLength(1);
        });

        it('should record command registrations', () => {
            const api = createMockApi();
            api.registerCommand({ name: '/test', description: 'Test', handler: async () => 'ok' });
            expect(api.registeredCommands).toHaveLength(1);
        });
    });

    describe('TestPluginHarness', () => {
        it('should run full lifecycle', async () => {
            let activated = false;
            let deactivated = false;
            const harness = new TestPluginHarness({
                activate: async () => { activated = true; },
                deactivate: async () => { deactivated = true; },
            });

            expect(harness.isActivated()).toBe(false);
            await harness.activate();
            expect(harness.isActivated()).toBe(true);
            expect(activated).toBe(true);

            await harness.deactivate();
            expect(harness.isActivated()).toBe(false);
            expect(deactivated).toBe(true);
        });

        it('should provide mock accessors', () => {
            const harness = new TestPluginHarness({ config: { key: 'val' } });
            expect(harness.getContext().config.key).toBe('val');
            expect(harness.getLogger()).toBeDefined();
            expect(harness.getEventBus()).toBeDefined();
            expect(harness.getApi()).toBeDefined();
        });
    });
});
