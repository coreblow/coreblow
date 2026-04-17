/**
 * CoreBlow Phase 36 — Dispatch→Middleware→Execute→History Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   CommandDispatcher.dispatch → middleware pipeline → execute → record history
 */
import { describe, it, expect } from 'vitest';
import { CommandDispatcher } from '../../src/commands/dispatcher.js';
import { CommandCooldown } from '../../src/commands/cooldown.js';
import { AutoComplete } from '../../src/commands/autocomplete.js';

describe('Phase36 Chain: Dispatch→Middleware→Execute Pipeline', () => {

    it('register commands → dispatch → verify history → autocomplete', async () => {
        const dispatcher = new CommandDispatcher();
        const ac = new AutoComplete();

        // Register custom command
        dispatcher.register({
            name: 'ping', description: 'Ping',
            handler: async () => 'pong',
        });

        // Set up autocomplete with all commands
        const cmdNames = dispatcher.listCommands(true).map(c => c.name);
        ac.setCommands(cmdNames);

        // Dispatch commands
        await dispatcher.dispatch('/ping');
        await dispatcher.dispatch('/help');
        await dispatcher.dispatch('/status');

        // Verify history
        const history = dispatcher.getHistory();
        expect(history).toHaveLength(3);
        expect(history.every(h => !h.error)).toBe(true);

        // Verify autocomplete
        expect(ac.complete('p')).toContain('ping');
        expect(ac.complete('he')).toContain('help');
    });

    it('middleware chain: logging → auth → execute', async () => {
        const dispatcher = new CommandDispatcher();
        const log: string[] = [];

        // Add logging middleware
        dispatcher.use(async (ctx, next) => {
            log.push(`before:${ctx.command}`);
            await next();
            log.push(`after:${ctx.command}`);
        });

        // Add auth middleware
        dispatcher.use(async (ctx, next) => {
            log.push('auth-check');
            await next();
        });

        dispatcher.register({
            name: 'test-mw', description: 'Test middleware',
            handler: async () => { log.push('handler'); return 'ok'; },
        });

        const result = await dispatcher.dispatch('/test-mw');
        expect(result.output).toBe('ok');

        // Middleware execution order
        expect(log[0]).toBe('before:test-mw');
        expect(log[1]).toBe('auth-check');
        expect(log).toContain('handler');
    });

    it('cooldown integration: check → dispatch → block repeat', async () => {
        const dispatcher = new CommandDispatcher();
        const cooldown = new CommandCooldown(5000);

        dispatcher.register({
            name: 'limited', description: 'Rate limited',
            handler: async () => 'ok',
        });

        // First call: allowed
        const allowed = cooldown.check('user-1', 'limited');
        expect(allowed).toBe(true);
        const r1 = await dispatcher.dispatch('/limited', { senderId: 'user-1' });
        expect(r1.output).toBe('ok');

        // Second call: blocked by cooldown
        const blocked = cooldown.check('user-1', 'limited');
        expect(blocked).toBe(false);
        expect(cooldown.remaining('user-1', 'limited')).toBeGreaterThan(0);
    });
});
