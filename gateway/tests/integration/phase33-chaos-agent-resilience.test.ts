/**
 * CoreBlow Phase 33 — Agent Resilience & Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - Session edge cases: limits, TTL cleanup, bulk operations
 *   - Context edge cases: empty messages, token overflow
 *   - Command edge cases: empty input, special chars, duplicate registration
 */
import { describe, it, expect } from 'vitest';
import { SessionPersistenceManager } from '../../src/agents/session-persistence.js';
import { ContextManager, estimateMessageTokens } from '../../src/agents/context.js';
import { CommandRegistry } from '../../src/commands/registry.js';
import type { ChatMessage } from '../../src/providers/interface.js';

// ================================================================
describe('Phase33 Chaos: Session Edge Cases', () => {
    it('create 50 sessions → stats accurate', () => {
        const spm = new SessionPersistenceManager({ maxSessions: 100 });
        for (let i = 0; i < 50; i++) {
            spm.getOrCreate(`s-${i}`, { channel: i % 2 === 0 ? 'web' : 'telegram' });
        }

        const stats = spm.getStats();
        expect(stats.total).toBe(50);
        expect(stats.active).toBe(50);

        // Filter by channel
        expect(spm.list({ channel: 'web' })).toHaveLength(25);
        expect(spm.list({ channel: 'telegram' })).toHaveLength(25);
    });

    it('session with 0 TTL → never expires', () => {
        const spm = new SessionPersistenceManager({ defaultTtlMs: 0 });
        spm.getOrCreate('immortal');
        expect(spm.isExpired('immortal')).toBe(false);
    });

    it('non-existent session operations return false/undefined', () => {
        const spm = new SessionPersistenceManager();
        expect(spm.setTtl('ghost', 1000)).toBe(false);
        expect(spm.addTag('ghost', 'tag')).toBe(false);
        expect(spm.archive('ghost')).toBe(false);
        expect(spm.delete('ghost')).toBe(false);
        expect(spm.export('ghost')).toBeNull();
        expect(spm.getMetadata('ghost')).toBeUndefined();
    });

    it('session cleanup with archiveOnExpiry=false → deleted', () => {
        const spm = new SessionPersistenceManager({
            defaultTtlMs: 1, // 1ms TTL
            archiveOnExpiry: false,
        });
        spm.getOrCreate('expires-fast');

        // Wait for expiry
        const meta = spm.getMetadata('expires-fast')!;
        meta.lastActiveAt = Date.now() - 100; // Force expired

        const result = spm.cleanup();
        expect(result.expired).toBe(1);
        expect(result.deleted).toBe(1);
        expect(result.archived).toBe(0);
        expect(spm.getMetadata('expires-fast')).toBeUndefined();
    });
});

// ================================================================
describe('Phase33 Chaos: Context Edge Cases', () => {
    it('fitToWindow with empty message array', () => {
        const ctx = new ContextManager();
        const budget = ctx.calculateBudget(8192);
        const fitted = ctx.fitToWindow([], budget);
        expect(fitted).toHaveLength(0);
    });

    it('fitToWindow with only system message', () => {
        const ctx = new ContextManager();
        const budget = ctx.calculateBudget(8192);
        const msgs: ChatMessage[] = [{ role: 'system', content: 'System prompt' }];
        const fitted = ctx.fitToWindow(msgs, budget);
        expect(fitted).toHaveLength(1);
        expect(fitted[0]!.role).toBe('system');
    });

    it('large conversation → fitToWindow truncates old messages', () => {
        const ctx = new ContextManager();
        const budget = ctx.calculateBudget(500); // Very small budget

        // Create 100 messages
        const msgs: ChatMessage[] = [{ role: 'system', content: 'You are an assistant' }];
        for (let i = 0; i < 100; i++) {
            msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message number ${i} with some reasonable content here` });
        }

        const fitted = ctx.fitToWindow(msgs, budget);
        // Should be significantly fewer than 101 to fit budget
        expect(fitted.length).toBeLessThan(101);
        // System message still first
        expect(fitted[0]!.role).toBe('system');
        // Most recent messages should be preserved
        const lastFitted = fitted[fitted.length - 1]!;
        expect(lastFitted.content).toContain('99'); // Last user/assistant message
    });

    it('multiple pins with different priorities', () => {
        const ctx = new ContextManager();
        ctx.pin('s1', { role: 'user', content: 'Low priority' }, 1);
        ctx.pin('s1', { role: 'user', content: 'High priority' }, 10);
        ctx.pin('s1', { role: 'user', content: 'Medium priority' }, 5);

        const pinned = ctx.getPinned('s1');
        expect(pinned).toHaveLength(3);
    });
});

// ================================================================
describe('Phase33 Chaos: Command Edge Cases', () => {
    it('empty command input → returns null', () => {
        const reg = new CommandRegistry('/');
        expect(reg.parse('/')).toBeNull();
        expect(reg.parse('')).toBeNull();
        expect(reg.parse('  ')).toBeNull();
    });

    it('command with special characters in args', () => {
        const reg = new CommandRegistry('/');
        reg.register({
            name: 'search', description: 'Search', category: 'Utility',
            args: [{ name: 'query', description: 'Query', required: true, type: 'string' }],
            handler: async (ctx) => `Found: ${ctx.command.args.query}`,
        });

        const parsed = reg.parse('/search "hello world & foo=bar"');
        expect(parsed?.args.query).toBe('hello world & foo=bar');
    });

    it('command handler throws → result captures error', async () => {
        const reg = new CommandRegistry('/');
        reg.register({
            name: 'crash', description: 'Crashes', category: 'Debug',
            handler: async () => { throw new Error('handler-crash'); },
        });

        const result = await reg.run('/crash', {
            senderId: 'u1', senderName: 'User',
            sessionId: 's1', channel: 'web',
            reply: async () => {}, metadata: {},
        });
        expect(result?.success).toBe(false);
        expect(result?.error).toContain('handler-crash');
    });

    it('20 commands registered → help categorized correctly', () => {
        const reg = new CommandRegistry('/');
        for (let i = 0; i < 10; i++) {
            reg.register({ name: `cmd-a-${i}`, description: `A ${i}`, category: 'Group A', handler: async () => 'ok' });
        }
        for (let i = 0; i < 10; i++) {
            reg.register({ name: `cmd-b-${i}`, description: `B ${i}`, category: 'Group B', handler: async () => 'ok' });
        }

        const help = reg.generateHelp();
        expect(help).toContain('Group A');
        expect(help).toContain('Group B');

        const list = reg.getCommandList();
        expect(list).toHaveLength(20);
    });
});
