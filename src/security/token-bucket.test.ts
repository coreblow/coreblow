/**
 * CoreBlow — Token Bucket Unit Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenBucket } from './token-bucket.js';

describe('TokenBucket', () => {
    let bucket: TokenBucket;

    beforeEach(() => {
        vi.useFakeTimers();
        bucket = new TokenBucket(10, 2); // 10 max, 2 tokens/sec refill
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── Basic Consume ───────────────────────────────────────────

    describe('consume', () => {
        it('should allow consuming 1 token when available', () => {
            expect(bucket.consume('k1')).toBe(true);
        });

        it('should allow consuming multiple tokens', () => {
            expect(bucket.consume('k1', 5)).toBe(true);
            expect(bucket.remaining('k1')).toBe(5);
        });

        it('should reject when not enough tokens', () => {
            expect(bucket.consume('k1', 10)).toBe(true);
            expect(bucket.consume('k1', 1)).toBe(false);
        });

        it('should track totalConsumed', () => {
            bucket.consume('k1', 3);
            bucket.consume('k1', 2);
            const stats = bucket.getStats('k1');
            expect(stats!.consumed).toBe(5);
        });

        it('should track totalRejected', () => {
            bucket.consume('k1', 10); // drain
            bucket.consume('k1', 5);  // rejected
            const stats = bucket.getStats('k1');
            expect(stats!.rejected).toBe(5);
        });

        it('should consume exactly all tokens', () => {
            expect(bucket.consume('k1', 10)).toBe(true);
            expect(bucket.remaining('k1')).toBe(0);
        });
    });

    // ─── Check (non-consuming) ───────────────────────────────────

    describe('check', () => {
        it('should return true when tokens available', () => {
            expect(bucket.check('k1', 5)).toBe(true);
        });

        it('should return false when not enough tokens', () => {
            bucket.consume('k1', 10);
            expect(bucket.check('k1', 1)).toBe(false);
        });

        it('should NOT consume tokens', () => {
            bucket.check('k1', 5);
            expect(bucket.remaining('k1')).toBe(10); // still full
        });
    });

    // ─── Remaining ───────────────────────────────────────────────

    describe('remaining', () => {
        it('should return max tokens for a new key', () => {
            expect(bucket.remaining('new')).toBe(10);
        });

        it('should return floor value', () => {
            bucket.consume('k1', 3);
            expect(bucket.remaining('k1')).toBe(7);
        });
    });

    // ─── Refill ──────────────────────────────────────────────────

    describe('refill', () => {
        it('should refill tokens over time', () => {
            bucket.consume('k1', 10); // drain
            expect(bucket.remaining('k1')).toBe(0);

            vi.advanceTimersByTime(3000); // 3 sec × 2 tokens/sec = 6 tokens
            expect(bucket.remaining('k1')).toBe(6);
        });

        it('should cap refill at maxTokens', () => {
            bucket.consume('k1', 5); // 5 remaining
            vi.advanceTimersByTime(10000); // would add 20 tokens, but capped at 10
            expect(bucket.remaining('k1')).toBe(10);
        });

        it('should refill fractionally', () => {
            bucket.consume('k1', 10); // drain
            vi.advanceTimersByTime(500); // 0.5 sec × 2 = 1 token
            expect(bucket.remaining('k1')).toBe(1);
        });
    });

    // ─── WaitTime ────────────────────────────────────────────────

    describe('waitTime', () => {
        it('should return 0 when tokens available', () => {
            expect(bucket.waitTime('k1', 5)).toBe(0);
        });

        it('should return time in ms until tokens available', () => {
            bucket.consume('k1', 10); // drain
            // Need 4 tokens at 2/sec = 2 seconds = 2000ms
            expect(bucket.waitTime('k1', 4)).toBe(2000);
        });

        it('should return time for 1 token by default', () => {
            bucket.consume('k1', 10); // drain
            // Need 1 token at 2/sec = 500ms
            expect(bucket.waitTime('k1', 1)).toBe(500);
        });
    });

    // ─── Reset ───────────────────────────────────────────────────

    describe('reset', () => {
        it('should refill bucket to max', () => {
            bucket.consume('k1', 10);
            expect(bucket.reset('k1')).toBe(true);
            expect(bucket.remaining('k1')).toBe(10);
        });

        it('should return false for non-existent key', () => {
            expect(bucket.reset('nonexistent')).toBe(false);
        });
    });

    // ─── Configure ───────────────────────────────────────────────

    describe('configure', () => {
        it('should update existing bucket config', () => {
            bucket.consume('k1'); // create bucket
            bucket.configure('k1', 20, 5);
            const stats = bucket.getStats('k1');
            expect(stats!.max).toBe(20);
        });

        it('should create new bucket if key does not exist', () => {
            bucket.configure('new-key', 50, 10);
            expect(bucket.remaining('new-key')).toBe(50);
            expect(bucket.count()).toBe(1);
        });
    });

    // ─── Stats ───────────────────────────────────────────────────

    describe('getStats', () => {
        it('should return null for non-existent key', () => {
            expect(bucket.getStats('nonexistent')).toBeNull();
        });

        it('should return correct stats shape', () => {
            bucket.consume('k1', 3);
            const stats = bucket.getStats('k1')!;
            expect(stats).toHaveProperty('tokens');
            expect(stats).toHaveProperty('max');
            expect(stats).toHaveProperty('consumed');
            expect(stats).toHaveProperty('rejected');
            expect(stats.max).toBe(10);
            expect(stats.consumed).toBe(3);
        });
    });

    // ─── Remove ──────────────────────────────────────────────────

    describe('remove', () => {
        it('should remove an existing bucket', () => {
            bucket.consume('k1');
            expect(bucket.remove('k1')).toBe(true);
            expect(bucket.count()).toBe(0);
        });

        it('should return false for non-existent bucket', () => {
            expect(bucket.remove('nonexistent')).toBe(false);
        });
    });

    // ─── Count & Isolation ───────────────────────────────────────

    describe('count & isolation', () => {
        it('should track bucket count', () => {
            bucket.consume('a');
            bucket.consume('b');
            bucket.consume('c');
            expect(bucket.count()).toBe(3);
        });

        it('separate instances should be independent', () => {
            const bucket2 = new TokenBucket(10, 2);
            bucket.consume('k1', 10);
            expect(bucket.remaining('k1')).toBe(0);
            expect(bucket2.remaining('k1')).toBe(10);
        });
    });

    // ─── Default Config ──────────────────────────────────────────

    describe('default config', () => {
        it('should default to 100 max and 10 refill rate', () => {
            vi.useRealTimers();
            const defaultBucket = new TokenBucket();
            expect(defaultBucket.remaining('test')).toBe(100);
        });
    });
});
