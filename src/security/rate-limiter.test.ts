import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        vi.restoreAllMocks();
        limiter = new RateLimiter(5, 1000); // 5 hits per 1 second
    });

    // ─── Basic Functionality ─────────────────────────────────────

    describe('basic rate limiting', () => {
        it('should allow requests under the limit', () => {
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
        });

        it('should block requests at the limit', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.check('user-1')).toBe(true);
            }
            // 6th request should be blocked
            expect(limiter.check('user-1')).toBe(false);
        });

        it('should continue blocking after limit is exceeded', () => {
            for (let i = 0; i < 5; i++) limiter.check('user-1');
            expect(limiter.check('user-1')).toBe(false);
            expect(limiter.check('user-1')).toBe(false);
            expect(limiter.check('user-1')).toBe(false);
        });
    });

    // ─── Per-Key Isolation ───────────────────────────────────────

    describe('per-key isolation', () => {
        it('should track each key independently', () => {
            for (let i = 0; i < 5; i++) limiter.check('user-1');
            expect(limiter.check('user-1')).toBe(false);
            // user-2 should still be allowed
            expect(limiter.check('user-2')).toBe(true);
        });

        it('should allow multiple keys up to their limits', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.check('a')).toBe(true);
                expect(limiter.check('b')).toBe(true);
            }
            expect(limiter.check('a')).toBe(false);
            expect(limiter.check('b')).toBe(false);
        });
    });

    // ─── Window Expiry ───────────────────────────────────────────

    describe('window expiry', () => {
        it('should allow requests again after window expires', () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            for (let i = 0; i < 5; i++) limiter.check('user-1');
            expect(limiter.check('user-1')).toBe(false);

            // Advance time past the window
            vi.spyOn(Date, 'now').mockReturnValue(now + 1001);
            expect(limiter.check('user-1')).toBe(true);
        });

        it('should only expire old hits, keeping recent ones', () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            // 3 hits at time 0
            limiter.check('user-1');
            limiter.check('user-1');
            limiter.check('user-1');

            // 2 more hits at time 500
            vi.spyOn(Date, 'now').mockReturnValue(now + 500);
            limiter.check('user-1');
            limiter.check('user-1');

            // At time 1001, 3 early hits expire, 2 remain → 3 more allowed
            vi.spyOn(Date, 'now').mockReturnValue(now + 1001);
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-1')).toBe(false);
        });
    });

    // ─── Reset ───────────────────────────────────────────────────

    describe('reset', () => {
        it('should clear hits for a specific key', () => {
            for (let i = 0; i < 5; i++) limiter.check('user-1');
            expect(limiter.check('user-1')).toBe(false);

            limiter.reset('user-1');
            expect(limiter.check('user-1')).toBe(true);
        });

        it('should not affect other keys', () => {
            for (let i = 0; i < 5; i++) {
                limiter.check('user-1');
                limiter.check('user-2');
            }
            limiter.reset('user-1');
            expect(limiter.check('user-1')).toBe(true);
            expect(limiter.check('user-2')).toBe(false);
        });

        it('should handle resetting a non-existent key without error', () => {
            expect(() => limiter.reset('nonexistent')).not.toThrow();
        });
    });

    // ─── Default Config ──────────────────────────────────────────

    describe('default configuration', () => {
        it('should default to 100 max and 60000ms window', () => {
            const defaultLimiter = new RateLimiter();
            for (let i = 0; i < 100; i++) {
                expect(defaultLimiter.check('test')).toBe(true);
            }
            expect(defaultLimiter.check('test')).toBe(false);
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────

    describe('edge cases', () => {
        it('should handle empty string as key', () => {
            expect(limiter.check('')).toBe(true);
        });

        it('should handle special characters in key', () => {
            expect(limiter.check('user@domain.com/path?q=1')).toBe(true);
        });

        it('should work with limit of 1', () => {
            const strict = new RateLimiter(1, 1000);
            expect(strict.check('k')).toBe(true);
            expect(strict.check('k')).toBe(false);
        });

        it('separate instances should be independent', () => {
            const limiter2 = new RateLimiter(5, 1000);
            for (let i = 0; i < 5; i++) limiter.check('k');
            expect(limiter.check('k')).toBe(false);
            expect(limiter2.check('k')).toBe(true);
        });
    });
});
