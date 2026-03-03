// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandDispatcher } from './dispatcher.js';

describe('Command Dispatcher — Phase 9', () => {
    let dispatcher: CommandDispatcher;

    beforeEach(() => {
        dispatcher = new CommandDispatcher();
    });

    it('has built-in commands', () => {
        const cmds = dispatcher.listCommands();
        const names = cmds.map(c => c.name);
        expect(names).toContain('help');
        expect(names).toContain('status');
        expect(names).toContain('reset');
        expect(names).toContain('model');
        expect(names).toContain('doctor');
    });

    it('dispatches /help', async () => {
        const result = await dispatcher.dispatch('/help');
        expect(result.command).toBe('help');
        expect(result.output).toContain('Available Commands');
        expect(result.error).toBeUndefined();
    });

    it('dispatches /status', async () => {
        const result = await dispatcher.dispatch('/status');
        expect(result.output).toContain('CoreBlow Status');
        expect(result.output).toContain('Uptime');
    });

    it('dispatches /model with arg', async () => {
        const result = await dispatcher.dispatch('/model gpt-4o');
        expect(result.output).toContain('gpt-4o');
    });

    it('dispatches /model without arg', async () => {
        const result = await dispatcher.dispatch('/model');
        expect(result.output).toContain('Current model');
    });

    it('resolves aliases', async () => {
        const result = await dispatcher.dispatch('/h'); // alias for help
        expect(result.command).toBe('help');
        expect(result.output).toContain('Available Commands');
    });

    it('rejects unknown command', async () => {
        const result = await dispatcher.dispatch('/nonexistent');
        expect(result.error).toContain('Unknown command');
    });

    it('rejects empty input', async () => {
        const result = await dispatcher.dispatch('');
        expect(result.error).toContain('Empty');
    });

    it('parses flags correctly', async () => {
        let capturedFlags: Record<string, unknown> = {};
        dispatcher.register({
            name: 'test',
            description: 'test',
            handler: async (ctx) => { capturedFlags = ctx.flags; return 'ok'; },
        });
        await dispatcher.dispatch('/test arg1 --verbose --format=json');
        expect(capturedFlags.verbose).toBe(true);
        expect(capturedFlags.format).toBe('json');
    });

    it('registers custom command', async () => {
        dispatcher.register({
            name: 'greet',
            aliases: ['g'],
            description: 'Greet someone',
            handler: async (ctx) => `Hello ${ctx.args[0] ?? 'world'}!`,
        });
        const result = await dispatcher.dispatch('/greet Alice');
        expect(result.output).toBe('Hello Alice!');
    });

    it('ownerOnly blocks non-owners', async () => {
        dispatcher.register({
            name: 'admin',
            description: 'Admin only',
            ownerOnly: true,
            handler: async () => 'secret',
        });
        const result = await dispatcher.dispatch('/admin', { isOwner: false });
        expect(result.error).toContain('owner');
    });

    it('ownerOnly allows owners', async () => {
        dispatcher.register({
            name: 'admin',
            description: 'Admin only',
            ownerOnly: true,
            handler: async () => 'secret',
        });
        const result = await dispatcher.dispatch('/admin', { isOwner: true });
        expect(result.output).toBe('secret');
    });

    it('middleware runs before command', async () => {
        const order: string[] = [];
        dispatcher.use(async (_ctx, next) => { order.push('mw'); await next(); });
        dispatcher.register({ name: 'x', description: 'x', handler: async () => { order.push('cmd'); return 'done'; } });
        await dispatcher.dispatch('/x');
        expect(order).toEqual(['mw', 'cmd']);
    });

    it('middleware can block command', async () => {
        dispatcher.use(async () => { throw new Error('blocked'); });
        const result = await dispatcher.dispatch('/help');
        expect(result.error).toBe('blocked');
    });

    it('isCommand detects commands', () => {
        expect(dispatcher.isCommand('/help')).toBe(true);
        expect(dispatcher.isCommand('hello')).toBe(false);
        expect(dispatcher.isCommand('  /status')).toBe(true);
    });

    it('getHistory records executions', async () => {
        await dispatcher.dispatch('/help');
        await dispatcher.dispatch('/status');
        const history = dispatcher.getHistory();
        expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('hidden commands excluded from list', () => {
        dispatcher.register({ name: 'secret', description: 'hidden', hidden: true, handler: async () => '' });
        const visible = dispatcher.listCommands(false);
        const all = dispatcher.listCommands(true);
        expect(visible.find(c => c.name === 'secret')).toBeUndefined();
        expect(all.find(c => c.name === 'secret')).toBeDefined();
    });

    it('handles command handler error gracefully', async () => {
        dispatcher.register({ name: 'crash', description: 'crash', handler: async () => { throw new Error('boom'); } });
        const result = await dispatcher.dispatch('/crash');
        expect(result.error).toBe('boom');
    });
});
