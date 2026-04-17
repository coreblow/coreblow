/**
 * CoreBlow Security — RateLimiter Test Suite
 *
 * Covers: check() with sliding window, rate limit enforcement,
 * reset(), concurrent keys, window expiration, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new RateLimiter(5, 10_000); // 5 requests per 10 seconds
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── check() ────────────────────────────────────────────────

    describe('check()', () => {
        it('allows requests within rate limit', () => {
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
        });

        it('blocks after reaching max requests in window', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.check('user-1')).toBe(true);
            }
            // 6th request should be blocked
            expect(limiter.check('user-1')).toBe(false);
        });

        it('allows again after window expires', () => {
            for (let i = 0; i < 5; i++) {
                limiter.check('user-1');
            }
            expect(limiter.check('user-1')).toBe(false);

            // Advance time past the window
            vi.advanceTimersByTime(11_000);

            // Should be allowed again
            expect(limiter.check('user-1')).toBe(true);
        });

        it('tracks different keys independently', () => {
            // Fill up user-1
            for (let i = 0; i < 5; i++) {
                limiter.check('user-1');
            }
            expect(limiter.check('user-1')).toBe(false);

            // user-2 should still be allowed
            expect(limiter.check('user-2')).toBe(true);
        });

        it('uses sliding window — old hits expire individually', () => {
            // Make 3 requests at t=0
            limiter.check('u');
            limiter.check('u');
            limiter.check('u');

            // Advance 5 seconds
            vi.advanceTimersByTime(5_000);

            // Make 2 more (total 5 in window)
            limiter.check('u');
            limiter.check('u');
            expect(limiter.check('u')).toBe(false); // At limit

            // Advance 6 more seconds (total 11s from start)
            // First 3 hits from t=0 should have expired (window is 10s)
            vi.advanceTimersByTime(6_000);

            // Should have room for 3 more (only 2 from t=5 still in window)
            expect(limiter.check('u')).toBe(true);
            expect(limiter.check('u')).toBe(true);
            expect(limiter.check('u')).toBe(true);
            expect(limiter.check('u')).toBe(false);
        });
    });

    // ─── reset() ────────────────────────────────────────────────

    describe('reset()', () => {
        it('clears hit history for a key', () => {
            for (let i = 0; i < 5; i++) limiter.check('user-1');
            expect(limiter.check('user-1')).toBe(false);

            limiter.reset('user-1');
            expect(limiter.check('user-1')).toBe(true);
        });

        it('does not affect other keys', () => {
            for (let i = 0; i < 5; i++) limiter.check('user-1');
            for (let i = 0; i < 5; i++) limiter.check('user-2');

            limiter.reset('user-1');

            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-2')).toBe(false);
        });

        it('does not throw for unknown key', () => {
            expect(() => limiter.reset('nonexistent')).not.toThrow();
        });
    });

    // ─── Constructor Defaults ───────────────────────────────────

    describe('constructor defaults', () => {
        it('defaults to 100 requests per 60 seconds', () => {
            const defaultLimiter = new RateLimiter();
            for (let i = 0; i < 100; i++) {
                expect(defaultLimiter.check('user')).toBe(true);
            }
            expect(defaultLimiter.check('user')).toBe(false);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles empty key string', () => {
            expect(limiter.check('')).toBe(true);
        });

        it('allows exactly max requests', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.check('user')).toBe(true);
            }
        });

        it('first request to a new key always succeeds', () => {
            expect(limiter.check('brand-new-user')).toBe(true);
        });
    });
});
