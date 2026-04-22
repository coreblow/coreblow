/**
 * CoreBlow — Rate Limiter Tests
 *
 * Tests for token bucket: allow, inspect, refill, reset, clear.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

const cfg = { maxTokens: 5, refillRate: 10 }; // 10 tokens/sec

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        limiter = new RateLimiter();
    });

    describe('allow', () => {
        it('allows requests under limit', () => {
            expect(limiter.allow('user-1', cfg)).toBe(true);
            expect(limiter.allow('user-1', cfg)).toBe(true);
        });

        it('blocks after tokens exhausted', () => {
            for (let i = 0; i < 5; i++) limiter.allow('user-1', cfg);
            expect(limiter.allow('user-1', cfg)).toBe(false);
        });

        it('allows consuming multiple tokens', () => {
            expect(limiter.allow('user-1', cfg, 3)).toBe(true);
            expect(limiter.allow('user-1', cfg, 3)).toBe(false); // only 2 left
        });

        it('isolates buckets by key', () => {
            for (let i = 0; i < 5; i++) limiter.allow('a', cfg);
            expect(limiter.allow('a', cfg)).toBe(false);
            expect(limiter.allow('b', cfg)).toBe(true); // separate bucket
        });
    });

    describe('inspect', () => {
        it('reports remaining tokens without consuming', () => {
            limiter.allow('user-1', cfg); // consumes 1
            const info = limiter.inspect('user-1', cfg);
            expect(info.remaining).toBe(4);
            expect(info.allowed).toBe(true);
        });

        it('reports not allowed when empty', () => {
            for (let i = 0; i < 5; i++) limiter.allow('user-1', cfg);
            const info = limiter.inspect('user-1', cfg);
            expect(info.allowed).toBe(false);
        });
    });

    describe('reset', () => {
        it('removes a bucket', () => {
            limiter.allow('user-1', cfg);
            expect(limiter.reset('user-1')).toBe(true);
            // After reset, bucket is fresh
            expect(limiter.inspect('user-1', cfg).remaining).toBe(5);
        });

        it('returns false for unknown bucket', () => {
            expect(limiter.reset('ghost')).toBe(false);
        });
    });

    describe('clear', () => {
        it('removes all buckets', () => {
            limiter.allow('a', cfg);
            limiter.allow('b', cfg);
            limiter.clear();
            // Both should be fresh
            expect(limiter.inspect('a', cfg).remaining).toBe(5);
            expect(limiter.inspect('b', cfg).remaining).toBe(5);
        });
    });
});
