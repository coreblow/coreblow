/**
 * Tests: Commands Module — Registry, Parser, Execution
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../src/commands/registry.js';

describe('CommandRegistry', () => {
    let registry: CommandRegistry;

    beforeEach(() => {
        registry = new CommandRegistry('/');
    });

    describe('register', () => {
        it('registers a command', () => {
            registry.register({
                name: 'help', description: 'Show help', category: 'general',
                handler: async () => 'Help text',
            });
            const list = registry.getCommandList();
            expect(list.some(c => c.name === 'help')).toBe(true);
        });

        it('registers command with aliases', () => {
            registry.register({
                name: 'help', description: 'Help', aliases: ['h'], category: 'general',
                handler: async () => 'Help',
            });
            // Alias-based parse should resolve
            const parsed = registry.parse('/h');
            expect(parsed).not.toBeNull();
            expect(parsed!.name).toBe('help');
        });

        it('registers subcommands', () => {
            registry.register({
                name: 'config', description: 'Config', category: 'admin',
                subcommands: [{
                    name: 'set', description: 'Set', category: 'admin',
                    handler: async () => 'OK',
                }],
                handler: async () => 'Config',
            });
            const parsed = registry.parse('/config set');
            expect(parsed).not.toBeNull();
            expect(parsed!.name).toBe('config set');
        });
    });

    describe('unregister', () => {
        it('removes a registered command', () => {
            registry.register({
                name: 'test', description: 'Test', category: 'test',
                handler: async () => '',
            });
            expect(registry.unregister('test')).toBe(true);
            expect(registry.getCommandList().some(c => c.name === 'test')).toBe(false);
        });

        it('returns false for non-existent', () => {
            expect(registry.unregister('nonexistent')).toBe(false);
        });
    });

    describe('isCommand', () => {
        it('detects commands', () => {
            expect(registry.isCommand('/help')).toBe(true);
            expect(registry.isCommand('  /help')).toBe(true);
        });

        it('rejects non-commands', () => {
            expect(registry.isCommand('hello world')).toBe(false);
        });
    });

    describe('parse', () => {
        it('parses simple command', () => {
            const parsed = registry.parse('/help');
            expect(parsed).not.toBeNull();
            expect(parsed!.name).toBe('help');
        });

        it('parses with args', () => {
            const parsed = registry.parse('/say hello world');
            expect(parsed).not.toBeNull();
            expect(parsed!.name).toBe('say');
        });

        it('parses flags', () => {
            registry.register({
                name: 'cfg', description: 'Config', category: 'admin',
                flags: [{ name: 'verbose', alias: 'v', description: 'Verbose', type: 'boolean' }],
                handler: async () => '',
            });
            const parsed = registry.parse('/cfg --verbose');
            expect(parsed).not.toBeNull();
            expect(parsed!.flags?.verbose).toBe(true);
        });

        it('returns null for non-command', () => {
            expect(registry.parse('not a command')).toBeNull();
        });
    });

    describe('execute', () => {
        it('executes a registered command', async () => {
            registry.register({
                name: 'ping', description: 'Ping', category: 'test',
                handler: async () => 'pong',
            });
            const parsed = registry.parse('/ping')!;
            const result = await registry.execute(parsed, { senderId: 'u1', channel: 'test' });
            expect(result.success).toBe(true);
            expect(result.output).toBe('pong');
        });

        it('returns error for unknown command', async () => {
            const parsed = registry.parse('/unknown')!;
            const result = await registry.execute(parsed, { senderId: 'u1', channel: 'test' });
            expect(result.success).toBe(false);
        });

        it('checks permissions', async () => {
            registry.register({
                name: 'admin-cmd', description: 'Admin', category: 'admin',
                permission: 'admin',
                handler: async () => 'admin action',
            });
            const parsed = registry.parse('/admin-cmd')!;
            const result = await registry.execute(parsed, {
                senderId: 'u1', channel: 'test', metadata: { role: 'user' },
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('admin');
        });

        it('records history', async () => {
            registry.register({
                name: 'test', description: 'Test', category: 'test',
                handler: async () => 'ok',
            });
            await registry.run('/test', { senderId: 'u1', channel: 'c1' });
            const history = registry.getHistory();
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].command).toBe('test');
        });
    });

    describe('run (convenience)', () => {
        it('parses and executes', async () => {
            registry.register({
                name: 'echo', description: 'Echo', category: 'test',
                handler: async () => 'echoed',
            });
            const result = await registry.run('/echo hello', { senderId: 'u1', channel: 'test' });
            expect(result).not.toBeNull();
            expect(result!.success).toBe(true);
        });

        it('returns null for non-command', async () => {
            const result = await registry.run('hello', { senderId: 'u1', channel: 'test' });
            expect(result).toBeNull();
        });
    });

    describe('generateHelp', () => {
        it('generates help for all commands', () => {
            registry.register({
                name: 'help', description: 'Show help', category: 'general',
                handler: async () => '',
            });
            const help = registry.generateHelp();
            expect(help).toContain('help');
        });

        it('generates help for specific command', () => {
            registry.register({
                name: 'config', description: 'Configuration', category: 'admin',
                handler: async () => '',
            });
            const help = registry.generateHelp('config');
            expect(help).toContain('config');
            expect(help).toContain('Configuration');
        });
    });

    describe('getStats', () => {
        it('reports command counts', () => {
            registry.register({
                name: 'a', description: 'A', category: 'test', aliases: ['x'],
                handler: async () => '',
            });
            const stats = registry.getStats();
            expect(stats.totalCommands).toBeGreaterThanOrEqual(1);
            expect(stats.totalAliases).toBeGreaterThanOrEqual(1);
        });
    });
});

import { evalCommand } from '../../src/commands/builtins/eval-cmd.js';

describe('evalCommand', () => {
    it('returns usage for no args', async () => {
        expect(await evalCommand([])).toContain('Usage');
    });

    it('evaluates safe math', async () => {
        expect(await evalCommand(['2', '+', '2'])).toContain('4');
    });

    it('blocks require()', async () => {
        expect((await evalCommand(["require('child_process')"])).toLowerCase()).toContain('blocked');
    });

    it('blocks process.exit', async () => {
        expect((await evalCommand(['process.exit(1)'])).toLowerCase()).toContain('blocked');
    });
});
