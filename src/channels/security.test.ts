/**
 * Channel Security Guard test suite
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelSecurityGuard } from './security.js';

describe('ChannelSecurityGuard', () => {
    let guard: ChannelSecurityGuard;

    beforeEach(() => {
        guard = new ChannelSecurityGuard();
    });

    describe('message validation', () => {
        it('allows normal messages', () => {
            expect(guard.checkMessage('user1', 'Hello world', 'discord').allowed).toBe(true);
        });

        it('rejects oversized messages', () => {
            const big = 'x'.repeat(100_000);
            expect(guard.checkMessage('user1', big, 'discord').allowed).toBe(false);
        });
    });

    describe('sender filtering', () => {
        it('blocks blocklisted senders', () => {
            guard = new ChannelSecurityGuard({ senderBlocklist: ['bad_user'] });
            expect(guard.checkMessage('bad_user', 'hi', 'discord').allowed).toBe(false);
            expect(guard.checkMessage('good_user', 'hi', 'discord').allowed).toBe(true);
        });

        it('enforces allowlist', () => {
            guard = new ChannelSecurityGuard({ senderAllowlist: ['vip_user'] });
            expect(guard.checkMessage('vip_user', 'hi', 'discord').allowed).toBe(true);
            expect(guard.checkMessage('random_user', 'hi', 'discord').allowed).toBe(false);
        });
    });

    describe('rate limiting', () => {
        it('blocks after exceeding limit', () => {
            guard = new ChannelSecurityGuard({ rateLimitMax: 3, rateLimitWindowMs: 60_000 });

            expect(guard.checkMessage('u', 'msg1', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u', 'msg2', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u', 'msg3', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u', 'msg4', 'ch').allowed).toBe(false);
        });

        it('allows different senders independently', () => {
            guard = new ChannelSecurityGuard({ rateLimitMax: 1, rateLimitWindowMs: 60_000 });

            expect(guard.checkMessage('u1', 'msg', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u2', 'msg', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u1', 'msg2', 'ch').allowed).toBe(false);
        });

        it('resets rate limit', () => {
            guard = new ChannelSecurityGuard({ rateLimitMax: 1, rateLimitWindowMs: 60_000 });
            guard.checkMessage('u', 'msg', 'ch');
            expect(guard.checkMessage('u', 'msg2', 'ch').allowed).toBe(false);
            guard.resetRateLimit('u');
            expect(guard.checkMessage('u', 'msg3', 'ch').allowed).toBe(true);
        });
    });

    describe('spam detection', () => {
        it('blocks duplicate messages', () => {
            guard = new ChannelSecurityGuard({ detectSpam: true, spamWindowMs: 10_000 });
            expect(guard.checkMessage('u', 'same msg', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u', 'same msg', 'ch').allowed).toBe(false);
        });

        it('allows different messages', () => {
            guard = new ChannelSecurityGuard({ detectSpam: true, spamWindowMs: 10_000 });
            expect(guard.checkMessage('u', 'msg A', 'ch').allowed).toBe(true);
            expect(guard.checkMessage('u', 'msg B', 'ch').allowed).toBe(true);
        });
    });

    describe('injection detection', () => {
        it('detects XSS attempts', () => {
            const result = guard.checkMessage('u', '<script>alert("xss")</script>', 'ch');
            expect(result.allowed).toBe(false);
            expect(result.threats).toContain('xss');
        });

        it('detects SQL injection', () => {
            const result = guard.checkMessage('u', "'; DROP TABLE users;--", 'ch');
            expect(result.allowed).toBe(false);
        });
    });

    describe('sanitize', () => {
        it('strips HTML tags', () => {
            const result = guard.sanitize('<script>alert("x")</script>Hello');
            expect(result).not.toContain('<script>');
            expect(result).toContain('Hello');
        });
    });
});
