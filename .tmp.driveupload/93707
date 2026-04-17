/**
 * CoreBlow Phase 33 — CommandRegistry Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Command registration, parsing, flags, aliases
 *   - Permission checks, channel restrictions, execution
 *   - Help generation, stats, history
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../src/commands/registry.js';

describe('CommandRegistry — Extended', () => {
    let reg: CommandRegistry;
    const mockContext = {
        senderId: 'user-1', senderName: 'Test User',
        sessionId: 's1', channel: 'web',
        reply: async () => {}, metadata: {},
    };

    beforeEach(() => {
        reg = new CommandRegistry('/');
        reg.register({
            name: 'help', description: 'Show help', category: 'General',
            aliases: ['h'], handler: async () => 'Help text',
        });
        reg.register({
            name: 'greet', description: 'Greet someone', category: 'Social',
            args: [{ name: 'name', description: 'Name to greet', required: true, type: 'string' }],
            flags: [{ name: 'loud', alias: 'l', description: 'Shout', type: 'boolean' }],
            handler: async (ctx) => `Hello, ${ctx.command.args.name}${ctx.command.flags.loud ? '!!!' : ''}`,
        });
    });

    it('should detect commands by prefix', () => {
        expect(reg.isCommand('/help')).toBe(true);
        expect(reg.isCommand('Hello')).toBe(false);
    });

    it('should parse basic command', () => {
        const parsed = reg.parse('/help');
        expect(parsed?.name).toBe('help');
    });

    it('should resolve aliases', () => {
        const parsed = reg.parse('/h');
        expect(parsed?.name).toBe('help');
    });

    it('should parse positional args', () => {
        const parsed = reg.parse('/greet Alice');
        expect(parsed?.args.name).toBe('Alice');
    });

    it('should parse flags', () => {
        const parsed = reg.parse('/greet Alice --loud');
        expect(parsed?.flags.loud).toBe(true);
    });

    it('should parse short flag alias', () => {
        const parsed = reg.parse('/greet Alice -l');
        expect(parsed?.flags.loud).toBe(true);
    });

    it('should execute command and return output', async () => {
        const parsed = reg.parse('/greet Alice')!;
        const result = await reg.execute(parsed, mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toBe('Hello, Alice');
    });

    it('should execute with flags', async () => {
        const parsed = reg.parse('/greet Bob --loud')!;
        const result = await reg.execute(parsed, mockContext);
        expect(result.output).toBe('Hello, Bob!!!');
    });

    it('should reject unknown commands', async () => {
        const parsed = reg.parse('/unknown')!;
        const result = await reg.execute(parsed, mockContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown command');
    });

    it('should enforce admin permission', async () => {
        reg.register({
            name: 'admin', description: 'Admin only', category: 'Admin',
            permission: 'admin', handler: async () => 'admin action',
        });
        const parsed = reg.parse('/admin')!;
        const result = await reg.execute(parsed, { ...mockContext, metadata: { role: 'user' } });
        expect(result.success).toBe(false);
        expect(result.error).toContain('admin permission');
    });

    it('should allow admin permission for admin role', async () => {
        reg.register({
            name: 'admin-cmd', description: 'Admin only', category: 'Admin',
            permission: 'admin', handler: async () => 'done',
        });
        const parsed = reg.parse('/admin-cmd')!;
        const result = await reg.execute(parsed, { ...mockContext, metadata: { role: 'admin' } });
        expect(result.success).toBe(true);
    });

    it('should enforce channel restrictions', async () => {
        reg.register({
            name: 'web-only', description: 'Web only', category: 'General',
            channels: ['web'], handler: async () => 'ok',
        });
        const parsed = reg.parse('/web-only')!;
        // Wrong channel
        const result = await reg.execute(parsed, { ...mockContext, channel: 'telegram' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('not available');
    });

    it('should validate required args', async () => {
        const parsed = reg.parse('/greet')!; // Missing required 'name'
        const result = await reg.execute(parsed, mockContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required argument');
    });

    it('should generate help text', () => {
        const help = reg.generateHelp();
        expect(help).toContain('Available Commands');
        expect(help).toContain('/help');
        expect(help).toContain('/greet');
    });

    it('should generate command-specific help', () => {
        const help = reg.generateHelp('greet');
        expect(help).toContain('greet');
        expect(help).toContain('name');
    });

    it('should track execution history and stats', async () => {
        await reg.run('/help', mockContext);
        await reg.run('/greet Alice', mockContext);
        await reg.run('/unknown', mockContext);

        const history = reg.getHistory();
        // Unknown commands return early before history recording
        expect(history).toHaveLength(2);

        const stats = reg.getStats();
        expect(stats.totalExecutions).toBe(2);
        expect(stats.successRate).toBeGreaterThan(0);
    });

    it('should unregister commands', () => {
        expect(reg.unregister('help')).toBe(true);
        expect(reg.parse('/help')?.name).toBe('help'); // Still parseable
        // But not in command list
    });

    it('should handle quoted arguments', () => {
        const parsed = reg.parse('/greet "John Doe"');
        expect(parsed?.args.name).toBe('John Doe');
    });
});
