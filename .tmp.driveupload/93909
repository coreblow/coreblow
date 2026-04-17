/**
 * CoreBlow Phase 33 — Command Parse→Validate→Execute→History Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   CommandRegistry.parse → validate → execute → record history → generate stats
 */
import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../src/commands/registry.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase33 Chain: Command Execution Pipeline', () => {
    const makeCtx = (overrides = {}) => ({
        senderId: 'user-1', senderName: 'Alice',
        sessionId: 'session-1', channel: 'web',
        reply: async () => {}, metadata: {},
        ...overrides,
    });

    it('full pipeline: register → parse → execute → history → stats', async () => {
        const reg = new CommandRegistry('/');
        const audit = new EventStore();

        // Register commands
        reg.register({
            name: 'status', description: 'Check status', category: 'System',
            handler: async () => 'All systems operational',
        });
        reg.register({
            name: 'echo', description: 'Echo back', category: 'Utility',
            args: [{ name: 'message', description: 'Message', required: true, type: 'string' }],
            handler: async (ctx) => `Echo: ${ctx.command.args.message}`,
        });

        // Execute commands
        const r1 = await reg.run('/status', makeCtx());
        expect(r1?.success).toBe(true);
        expect(r1?.output).toBe('All systems operational');

        const r2 = await reg.run('/echo "Hello World"', makeCtx());
        expect(r2?.success).toBe(true);
        expect(r2?.output).toBe('Echo: Hello World');

        // Non-command text returns null
        const r3 = await reg.run('Just a message', makeCtx());
        expect(r3).toBeNull();

        // Record audit
        audit.append('command:executed', 'system', { command: 'status', success: true });
        audit.append('command:executed', 'system', { command: 'echo', success: true });

        // Verify history
        const history = reg.getHistory();
        expect(history).toHaveLength(2);
        expect(history.every(h => h.success)).toBe(true);

        // Verify stats
        const stats = reg.getStats();
        expect(stats.totalExecutions).toBe(2);
        expect(stats.successRate).toBe(100);
    });

    it('permission escalation pipeline: user → admin → owner', async () => {
        const reg = new CommandRegistry('/');

        reg.register({ name: 'public', description: 'Public', category: 'General', handler: async () => 'ok' });
        reg.register({ name: 'admin', description: 'Admin', category: 'Admin', permission: 'admin', handler: async () => 'ok' });
        reg.register({ name: 'owner', description: 'Owner', category: 'Owner', permission: 'owner', handler: async () => 'ok' });

        // User can use public
        const r1 = await reg.run('/public', makeCtx({ metadata: { role: 'user' } }));
        expect(r1?.success).toBe(true);

        // User can NOT use admin
        const r2 = await reg.run('/admin', makeCtx({ metadata: { role: 'user' } }));
        expect(r2?.success).toBe(false);

        // Admin can use admin
        const r3 = await reg.run('/admin', makeCtx({ metadata: { role: 'admin' } }));
        expect(r3?.success).toBe(true);

        // Admin can NOT use owner
        const r4 = await reg.run('/owner', makeCtx({ metadata: { role: 'admin' } }));
        expect(r4?.success).toBe(false);

        // Owner can use owner
        const r5 = await reg.run('/owner', makeCtx({ metadata: { role: 'owner' } }));
        expect(r5?.success).toBe(true);
    });

    it('subcommand pipeline: register parent + children → parse → execute', async () => {
        const reg = new CommandRegistry('/');

        reg.register({
            name: 'config', description: 'Config management', category: 'System',
            handler: async () => 'Config help',
            subcommands: [
                { name: 'get', description: 'Get config', category: 'System', handler: async (ctx) => `Value: ${ctx.command.args._0 || 'all'}` },
                { name: 'set', description: 'Set config', category: 'System', handler: async (ctx) => `Set: ${ctx.command.args._0} = ${ctx.command.args._1}` },
            ],
        });

        // Parent command
        const r1 = await reg.run('/config', makeCtx());
        expect(r1?.output).toBe('Config help');

        // Subcommand
        const r2 = await reg.run('/config get theme', makeCtx());
        expect(r2?.success).toBe(true);
    });
});
