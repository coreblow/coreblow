import { describe, it, expect } from 'vitest';
import { definePlugin, defineCommand, defineTool, defineHook, defineProvider } from './sdk.js';

describe('definePlugin', () => {
    it('creates plugin with defaults', () => {
        const plugin = definePlugin({});
        expect(plugin.commands).toEqual([]);
        expect(plugin.hooks).toEqual([]);
        expect(plugin.providers).toEqual([]);
        expect(plugin.tools).toEqual([]);
    });

    it('creates plugin with activate/deactivate', () => {
        const plugin = definePlugin({
            activate: async () => {},
            deactivate: async () => {},
        });
        expect(plugin.activate).toBeTypeOf('function');
        expect(plugin.deactivate).toBeTypeOf('function');
    });

    it('creates plugin with commands', () => {
        const cmd = defineCommand('test', 'A test cmd', async () => 'ok');
        const plugin = definePlugin({ commands: [cmd] });
        expect(plugin.commands).toHaveLength(1);
        expect(plugin.commands[0].name).toBe('test');
    });

    it('creates plugin with hooks', () => {
        const hook = defineHook('message', async () => {});
        const plugin = definePlugin({ hooks: [hook] });
        expect(plugin.hooks).toHaveLength(1);
    });

    it('creates plugin with tools', () => {
        const tool = defineTool('search', 'Search docs', {}, async () => 'result');
        const plugin = definePlugin({ tools: [tool] });
        expect(plugin.tools).toHaveLength(1);
    });

    it('creates plugin with providers', () => {
        const prov = defineProvider('my-llm', ['model-1'], async () => ({}));
        const plugin = definePlugin({ providers: [prov] });
        expect(plugin.providers).toHaveLength(1);
    });
});

describe('defineCommand', () => {
    it('creates a command', () => {
        const cmd = defineCommand('greet', 'Says hello', async (args) => `Hello ${args[0]}`);
        expect(cmd.name).toBe('greet');
        expect(cmd.description).toBe('Says hello');
        expect(cmd.handler).toBeTypeOf('function');
    });

    it('handler executes', async () => {
        const cmd = defineCommand('echo', 'Echo', async (args) => args.join(' '));
        expect(await cmd.handler(['a', 'b'])).toBe('a b');
    });
});

describe('defineTool', () => {
    it('creates a tool', () => {
        const tool = defineTool('calc', 'Calculator', { expr: 'string' }, async (p) => eval(p.expr as string));
        expect(tool.name).toBe('calc');
        expect(tool.parameters).toEqual({ expr: 'string' });
    });

    it('executes tool', async () => {
        const tool = defineTool('add', 'Add', {}, async (p) => (p.a as number) + (p.b as number));
        expect(await tool.execute({ a: 3, b: 4 })).toBe(7);
    });
});

describe('defineHook', () => {
    it('creates a hook with default priority', () => {
        const hook = defineHook('message', async () => {});
        expect(hook.event).toBe('message');
        expect(hook.priority).toBe(50);
    });

    it('creates a hook with custom priority', () => {
        const hook = defineHook('message', async () => {}, 100);
        expect(hook.priority).toBe(100);
    });
});

describe('defineProvider', () => {
    it('creates a provider', () => {
        const prov = defineProvider('ollama', ['llama3', 'mistral'], async () => ({}));
        expect(prov.name).toBe('ollama');
        expect(prov.models).toEqual(['llama3', 'mistral']);
    });
});
