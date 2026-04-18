// @ts-nocheck
/**
 * Commands Tests — Phase B: Business Logic
 * Tests: CommandRegistry — register, parse, execute, help, history
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from './registry.js';
import type { CommandDefinition, CommandContext } from './types.js';

describe('CommandRegistry', () => {
    let reg: CommandRegistry;

    const helpCmd: CommandDefinition = {
        name: 'help', description: 'Show help', category: 'General',
        handler: async () => 'Help text',
    };

    const modelCmd: CommandDefinition = {
        name: 'model', description: 'Manage models', category: 'AI',
        aliases: ['m'],
        args: [{ name: 'action', description: 'Action', type: 'string', required: true, choices: ['list', 'set', 'info'] }],
        flags: [
            { name: 'verbose', alias: 'v', description: 'Verbose output', type: 'boolean', default: false },
            { name: 'limit', alias: 'l', description: 'Limit results', type: 'number', default: 10 },
        ],
        handler: async (ctx) => `Model: ${ctx.command.args.action}`,
    };

    const adminCmd: CommandDefinition = {
        name: 'admin', description: 'Admin commands', category: 'System',
        permission: 'admin',
        handler: async () => 'Admin executed',
    };

    const ownerCmd: CommandDefinition = {
        name: 'shutdown', description: 'Shutdown', category: 'System',
        permission: 'owner', hidden: true,
        handler: async () => 'Shutting down',
    };

    const channelCmd: CommandDefinition = {
        name: 'discord-only', description: 'Discord only cmd', category: 'Channel',
        channels: ['discord'],
        handler: async () => 'Discord!',
    };

    const parentCmd: CommandDefinition = {
        name: 'config', description: 'Configuration', category: 'System',
        subcommands: [
            { name: 'get', description: 'Get config', handler: async (ctx) => `config: ${ctx.command.args.key}`, args: [{ name: 'key', description: 'Key', type: 'string', required: true }] },
            { name: 'set', description: 'Set config', handler: async () => 'Config set' },
        ],
        handler: async () => 'Config help',
    };

    const errorCmd: CommandDefinition = {
        name: 'crash', description: 'Crash', category: 'Test',
        handler: async () => { throw new Error('Kaboom'); },
    };

    const baseContext: Omit<CommandContext, 'command'> = {
        senderId: 'user1', senderName: 'Test User', channel: 'test', sessionId: 'sess-1', metadata: {},
    };

    beforeEach(() => {
        reg = new CommandRegistry('/');
        reg.register(helpCmd);
        reg.register(modelCmd);
        reg.register(adminCmd);
        reg.register(ownerCmd);
        reg.register(channelCmd);
        reg.register(parentCmd);
        reg.register(errorCmd);
    });

    // ─── isCommand ───
    it('detects commands', () => { expect(reg.isCommand('/help')).toBe(true); });
    it('rejects non-commands', () => { expect(reg.isCommand('hello')).toBe(false); });
    it('handles whitespace', () => { expect(reg.isCommand('  /help  ')).toBe(true); });

    // ─── Parse: basics ───
    it('parses simple command', () => {
        const p = reg.parse('/help');
        expect(p).not.toBeNull();
        expect(p!.name).toBe('help');
    });

    it('returns null for non-command', () => {
        expect(reg.parse('hello world')).toBeNull();
    });

    it('returns null for empty after prefix', () => {
        expect(reg.parse('/')).toBeNull();
    });

    // ─── Parse: args ───
    it('parses positional args', () => {
        const p = reg.parse('/model list');
        expect(p!.args.action).toBe('list');
    });

    // ─── Parse: flags ───
    it('parses long flags', () => {
        const p = reg.parse('/model list --verbose');
        expect(p!.flags.verbose).toBe(true);
    });

    it('parses flag with value', () => {
        const p = reg.parse('/model list --limit 20');
        expect(p!.flags.limit).toBe(20);
    });

    it('parses short alias flags', () => {
        const p = reg.parse('/model list -v');
        expect(p!.flags.verbose).toBe(true);
    });

    it('parses short alias with value', () => {
        const p = reg.parse('/model list -l 5');
        expect(p!.flags.limit).toBe(5);
    });

    // ─── Parse: defaults ───
    it('applies default flag values', () => {
        const p = reg.parse('/model list');
        expect(p!.flags.verbose).toBe(false);
        expect(p!.flags.limit).toBe(10);
    });

    // ─── Parse: aliases ───
    it('resolves aliases', () => {
        const p = reg.parse('/m list');
        expect(p!.name).toBe('model');
    });

    // ─── Parse: subcommands ───
    it('parses subcommands', () => {
        const p = reg.parse('/config get mykey');
        expect(p!.name).toBe('config get');
        expect(p!.args.key).toBe('mykey');
    });

    // ─── Parse: quoted strings ───
    it('handles quoted arguments', () => {
        const p = reg.parse('/model "list all"');
        expect(p!.args.action).toBe('list all');
    });

    it('handles single-quoted arguments', () => {
        const p = reg.parse("/model 'list all'");
        expect(p!.args.action).toBe('list all');
    });

    // ─── Parse: case insensitive ───
    it('parses case-insensitive command names', () => {
        const p = reg.parse('/HELP');
        expect(p!.name).toBe('help');
    });

    // ─── Execute: success ───
    it('executes simple command', async () => {
        const p = reg.parse('/help')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(true);
        expect(r.output).toBe('Help text');
    });

    it('executes with args', async () => {
        const p = reg.parse('/model list')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(true);
        expect(r.output).toContain('list');
    });

    // ─── Execute: unknown ───
    it('fails on unknown command', async () => {
        const p = reg.parse('/nonexistent')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(false);
        expect(r.error).toContain('Unknown command');
    });

    // ─── Execute: permissions ───
    it('blocks admin command for regular user', async () => {
        const p = reg.parse('/admin')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(false);
        expect(r.error).toContain('admin');
    });

    it('allows admin command for admin', async () => {
        const p = reg.parse('/admin')!;
        const r = await reg.execute(p, { ...baseContext, metadata: { role: 'admin' } });
        expect(r.success).toBe(true);
    });

    it('allows admin command for owner', async () => {
        const p = reg.parse('/admin')!;
        const r = await reg.execute(p, { ...baseContext, metadata: { role: 'owner' } });
        expect(r.success).toBe(true);
    });

    it('blocks owner command for admin', async () => {
        const p = reg.parse('/shutdown')!;
        const r = await reg.execute(p, { ...baseContext, metadata: { role: 'admin' } });
        expect(r.success).toBe(false);
        expect(r.error).toContain('owner');
    });

    it('allows owner command for owner', async () => {
        const p = reg.parse('/shutdown')!;
        const r = await reg.execute(p, { ...baseContext, metadata: { role: 'owner' } });
        expect(r.success).toBe(true);
    });

    // ─── Execute: channel restriction ───
    it('blocks command in wrong channel', async () => {
        const p = reg.parse('/discord-only')!;
        const r = await reg.execute(p, { ...baseContext, channel: 'telegram' });
        expect(r.success).toBe(false);
        expect(r.error).toContain('not available');
    });

    it('allows command in correct channel', async () => {
        const p = reg.parse('/discord-only')!;
        const r = await reg.execute(p, { ...baseContext, channel: 'discord' });
        expect(r.success).toBe(true);
    });

    // ─── Execute: required args validation ───
    it('fails on missing required args', async () => {
        const p = reg.parse('/model')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(false);
        expect(r.error).toContain('Missing required');
    });

    // ─── Execute: choices validation ───
    it('fails on invalid choice', async () => {
        const p = reg.parse('/model invalid-action')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(false);
        expect(r.error).toContain('Invalid value');
    });

    // ─── Execute: error handling ───
    it('catches handler errors gracefully', async () => {
        const p = reg.parse('/crash')!;
        const r = await reg.execute(p, baseContext);
        expect(r.success).toBe(false);
        expect(r.error).toContain('Kaboom');
    });

    // ─── Execute: duration ───
    it('records duration', async () => {
        const p = reg.parse('/help')!;
        const r = await reg.execute(p, baseContext);
        expect(r.durationMs).toBeGreaterThanOrEqual(0);
    });

    // ─── Run (parse + execute) ───
    it('run convenience method', async () => {
        const r = await reg.run('/help', baseContext);
        expect(r).not.toBeNull();
        expect(r!.success).toBe(true);
    });

    it('run returns null for non-command', async () => {
        expect(await reg.run('hello', baseContext)).toBeNull();
    });

    // ─── Unregister ───
    it('unregisters command', () => {
        expect(reg.unregister('help')).toBe(true);
        const p = reg.parse('/help')!;
        expect(p).not.toBeNull(); // still parses, but...
    });

    it('returns false unregistering non-existent', () => {
        expect(reg.unregister('nonexistent')).toBe(false);
    });

    // ─── Help ───
    it('generates general help', () => {
        const help = reg.generateHelp();
        expect(help).toContain('Available Commands');
        expect(help).toContain('help');
        expect(help).toContain('model');
    });

    it('generates specific help', () => {
        const help = reg.generateHelp('model');
        expect(help).toContain('model');
        expect(help).toContain('Manage models');
    });

    it('hides hidden commands', () => {
        const help = reg.generateHelp();
        expect(help).not.toContain('shutdown');
    });

    it('shows aliases in help', () => {
        const help = reg.generateHelp('model');
        expect(help).toContain('/m');
    });

    it('returns error for unknown help', () => {
        expect(reg.generateHelp('nonexistent')).toContain('Unknown');
    });

    it('resolves alias for help', () => {
        const help = reg.generateHelp('m');
        expect(help).toContain('model');
    });

    // ─── Command List ───
    it('returns command list', () => {
        const list = reg.getCommandList();
        expect(list.length).toBeGreaterThan(0);
        expect(list.some(c => c.name === 'help')).toBe(true);
    });

    it('excludes hidden from command list', () => {
        const list = reg.getCommandList();
        expect(list.some(c => c.name === 'shutdown')).toBe(false);
    });

    // ─── History ───
    it('records execution history', async () => {
        await reg.run('/help', baseContext);
        expect(reg.getHistory()).toHaveLength(1);
    });

    it('records failed executions', async () => {
        await reg.run('/crash', baseContext);
        const h = reg.getHistory();
        expect(h[0].success).toBe(false);
    });

    // ─── Stats ───
    it('tracks stats', async () => {
        await reg.run('/help', baseContext);
        await reg.run('/crash', baseContext);
        const stats = reg.getStats();
        expect(stats.totalExecutions).toBe(2);
        expect(stats.successRate).toBe(50);
    });

    // ─── Custom prefix ───
    it('supports custom prefix', () => {
        const r2 = new CommandRegistry('!');
        r2.register(helpCmd);
        expect(r2.isCommand('!help')).toBe(true);
        expect(r2.isCommand('/help')).toBe(false);
    });

    // ─── Edge: extra args ───
    it('puts extra args in rest bucket', () => {
        const p = reg.parse('/help extra1 extra2');
        expect(p!.args._0).toBe('extra1');
    });
});
