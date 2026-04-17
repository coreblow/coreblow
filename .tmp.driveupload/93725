/**
 * CoreBlow Phase 36 — CommandDispatcher Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Dispatch, parsing, aliases, owner-only, builtins
 *   - Middleware pipeline, history, error handling
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandDispatcher } from '../../src/commands/dispatcher.js';

describe('CommandDispatcher — Extended', () => {
    let dispatcher: CommandDispatcher;
    beforeEach(() => { dispatcher = new CommandDispatcher(); });

    it('should detect commands by / prefix', () => {
        expect(dispatcher.isCommand('/help')).toBe(true);
        expect(dispatcher.isCommand('hello')).toBe(false);
        expect(dispatcher.isCommand('  /status  ')).toBe(true);
    });

    it('should dispatch built-in /help', async () => {
        const result = await dispatcher.dispatch('/help');
        expect(result.command).toBe('help');
        expect(result.output).toContain('Available Commands');
    });

    it('should dispatch built-in /status', async () => {
        const result = await dispatcher.dispatch('/status');
        expect(result.command).toBe('status');
        expect(result.output).toContain('CoreBlow Status');
    });

    it('should resolve aliases', async () => {
        const result = await dispatcher.dispatch('/h');
        expect(result.command).toBe('help');
        expect(result.output).toContain('Available Commands');
    });

    it('should handle unknown commands', async () => {
        const result = await dispatcher.dispatch('/nonexistent');
        expect(result.error).toContain('Unknown command');
    });

    it('should return error for empty command', async () => {
        const result = await dispatcher.dispatch('');
        expect(result.error).toBeTruthy();
    });

    it('should register and dispatch custom command', async () => {
        dispatcher.register({
            name: 'greet', description: 'Greet someone',
            handler: async (ctx) => `Hello, ${ctx.args[0] || 'World'}!`,
        });
        const result = await dispatcher.dispatch('/greet Alice');
        expect(result.output).toBe('Hello, Alice!');
    });

    it('should parse flags correctly', async () => {
        dispatcher.register({
            name: 'flagtest', description: 'Test flags',
            handler: async (ctx) => JSON.stringify(ctx.flags),
        });
        const result = await dispatcher.dispatch('/flagtest --verbose --format=json');
        const flags = JSON.parse(result.output!);
        expect(flags.verbose).toBe(true);
        expect(flags.format).toBe('json');
    });

    it('should enforce owner-only restriction', async () => {
        dispatcher.register({
            name: 'admin-action', description: 'Admin only', ownerOnly: true,
            handler: async () => 'done',
        });

        const denied = await dispatcher.dispatch('/admin-action', { isOwner: false });
        expect(denied.error).toContain('owner privileges');

        const allowed = await dispatcher.dispatch('/admin-action', { isOwner: true });
        expect(allowed.output).toBe('done');
    });

    it('should record command history', async () => {
        await dispatcher.dispatch('/help');
        await dispatcher.dispatch('/status');
        await dispatcher.dispatch('/unknown');

        const history = dispatcher.getHistory();
        expect(history).toHaveLength(3);
    });

    it('should list non-hidden commands', () => {
        dispatcher.register({
            name: 'secret', description: 'Hidden', hidden: true,
            handler: async () => 'secret',
        });

        const visible = dispatcher.listCommands(false);
        const all = dispatcher.listCommands(true);
        expect(all.length).toBeGreaterThan(visible.length);
    });

    it('should handle command handler errors', async () => {
        dispatcher.register({
            name: 'crash', description: 'Crashes',
            handler: async () => { throw new Error('boom'); },
        });
        const result = await dispatcher.dispatch('/crash');
        expect(result.error).toContain('boom');
    });

    it('should dispatch /model with args', async () => {
        const result = await dispatcher.dispatch('/model gpt-4');
        expect(result.output).toContain('gpt-4');
    });

    it('should dispatch /doctor', async () => {
        const result = await dispatcher.dispatch('/doctor');
        expect(result.output).toContain('Diagnostics');
    });
});
