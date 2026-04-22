/**
 * CoreBlow — Context Manager Tests
 *
 * Tests for message management, token counting, trimming,
 * compaction, stats, and context window strategies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from './context-manager.js';

describe('ContextManager', () => {
    let ctx: ContextManager;

    beforeEach(() => {
        ctx = new ContextManager(1000, 200); // 1000 max, 200 reserved
    });

    describe('add + getMessages', () => {
        it('adds messages', () => {
            ctx.add('system', 'You are helpful');
            ctx.add('user', 'Hello');
            expect(ctx.getMessages()).toHaveLength(2);
            expect(ctx.getMessages()[0]).toEqual({ role: 'system', content: 'You are helpful' });
        });

        it('tracks message count', () => {
            ctx.add('user', 'Hi');
            ctx.add('assistant', 'Hello!');
            expect(ctx.count()).toBe(2);
        });
    });

    describe('token estimation', () => {
        it('estimates ~4 chars per token', () => {
            expect(ctx.estimateTokens('hello world')).toBe(3); // 11 / 4 = 2.75 → ceil = 3
        });

        it('estimates empty string as 0', () => {
            expect(ctx.estimateTokens('')).toBe(0);
        });
    });

    describe('getTotalTokens', () => {
        it('sums token counts', () => {
            ctx.add('user', 'aaaa'); // 1 token
            ctx.add('user', 'bbbbbbbb'); // 2 tokens
            expect(ctx.getTotalTokens()).toBe(3);
        });
    });

    describe('getAvailableTokens', () => {
        it('returns available space', () => {
            // max=1000, reserved=200, used=0 → available=800
            expect(ctx.getAvailableTokens()).toBe(800);
        });

        it('decreases as messages added', () => {
            ctx.add('user', 'a'.repeat(400)); // 100 tokens
            expect(ctx.getAvailableTokens()).toBe(700);
        });
    });

    describe('trim', () => {
        it('trims lowest-priority messages when over limit', () => {
            // Fill up context near limit (800 usable tokens)
            ctx.add('system', 'sys'.repeat(100), 10); // ~75 tokens, high priority
            ctx.add('user', 'old'.repeat(800), 1);     // ~600 tokens, LOW priority
            ctx.add('user', 'new'.repeat(400), 5);     // ~300 tokens, medium priority
            // Total would exceed 800, so lowest priority should be trimmed
            expect(ctx.getTotalTokens()).toBeLessThanOrEqual(800);
        });

        it('preserves system messages during trim', () => {
            ctx.add('system', 'important system prompt', 10);
            // Fill with low priority
            for (let i = 0; i < 20; i++) {
                ctx.add('user', 'x'.repeat(200), 1);
            }
            const msgs = ctx.getMessages();
            expect(msgs.some(m => m.role === 'system')).toBe(true);
        });
    });

    describe('getStats', () => {
        it('returns breakdown by role', () => {
            ctx.add('system', 'sys prompt');
            ctx.add('user', 'question');
            ctx.add('assistant', 'answer');
            const stats = ctx.getStats();
            expect(stats.totalMessages).toBe(3);
            expect(stats.systemTokens).toBeGreaterThan(0);
            expect(stats.userTokens).toBeGreaterThan(0);
            expect(stats.assistantTokens).toBeGreaterThan(0);
            expect(stats.maxTokens).toBe(1000);
            expect(stats.utilization).toBeGreaterThan(0);
        });
    });

    describe('compact', () => {
        it('replaces old messages with summary', () => {
            ctx.add('system', 'sys');
            ctx.add('user', 'msg1');
            ctx.add('assistant', 'resp1');
            ctx.add('user', 'msg2');
            ctx.add('assistant', 'resp2');
            ctx.compact('User asked 2 questions');
            // Should have: system + summary + last 2
            expect(ctx.count()).toBeLessThanOrEqual(5);
            const msgs = ctx.getMessages();
            expect(msgs.some(m => m.content.includes('Previous conversation summary'))).toBe(true);
        });

        it('does nothing with <= 2 messages', () => {
            ctx.add('user', 'only');
            ctx.compact('summary');
            expect(ctx.count()).toBe(1);
        });
    });

    describe('clearHistory', () => {
        it('keeps only system messages', () => {
            ctx.add('system', 'sys');
            ctx.add('user', 'hi');
            ctx.add('assistant', 'hello');
            ctx.clearHistory();
            expect(ctx.count()).toBe(1);
            expect(ctx.getMessages()[0]?.role).toBe('system');
        });
    });

    describe('reset', () => {
        it('clears everything', () => {
            ctx.add('system', 'sys');
            ctx.add('user', 'hi');
            ctx.reset();
            expect(ctx.count()).toBe(0);
        });
    });
});
