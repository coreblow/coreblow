/**
 * CoreBlow Security — TokenBucket Test Suite
 *
 * Covers: consume(), check(), remaining(), waitTime(),
 * reset(), configure(), getStats(), remove(), count(),
 * token refill over time, burst capacity, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucket } from './token-bucket.js';

describe('TokenBucket', () => {
    let bucket: TokenBucket;

    beforeEach(() => {
        vi.useFakeTimers();
        bucket = new TokenBucket(10, 2); // 10 max tokens, refill 2/sec
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── consume() ──────────────────────────────────────────────

    describe('consume()', () => {
        it('allows consumption within available tokens', () => {
            expect(bucket.consume('user-1', 5)).toBe(true);
        });

        it('defaults to consuming 1 token', () => {
            expect(bucket.consume('user-1')).toBe(true);
            expect(bucket.remaining('user-1')).toBe(9);
        });

        it('rejects when not enough tokens', () => {
            bucket.consume('user-1', 10); // Use all
            expect(bucket.consume('user-1', 1)).toBe(false);
        });

        it('rejects when requesting more than available', () => {
            expect(bucket.consume('user-1', 11)).toBe(false);
        });

        it('tracks totalConsumed', () => {
            bucket.consume('user-1', 3);
            bucket.consume('user-1', 2);

            const stats = bucket.getStats('user-1')!;
            expect(stats.consumed).toBe(5);
        });

        it('tracks totalRejected', () => {
            bucket.consume('user-1', 10);
            bucket.consume('user-1', 5); // Rejected

            const stats = bucket.getStats('user-1')!;
            expect(stats.rejected).toBe(5);
        });
    });

    // ─── Token Refill ───────────────────────────────────────────

    describe('token refill', () => {
        it('refills tokens over time', () => {
            bucket.consume('user-1', 10); // Use all 10
            expect(bucket.remaining('user-1')).toBe(0);

            // Advance 3 seconds — should refill 6 tokens (2/sec)
            vi.advanceTimersByTime(3000);
            expect(bucket.remaining('user-1')).toBe(6);
        });

        it('caps at maxTokens', () => {
            bucket.consume('user-1', 5);

            // Advance 60 seconds — should cap at max (10)
            vi.advanceTimersByTime(60_000);
            expect(bucket.remaining('user-1')).toBe(10);
        });

        it('allows consumption after partial refill', () => {
            bucket.consume('user-1', 10);
            vi.advanceTimersByTime(2000); // +4 tokens

            expect(bucket.consume('user-1', 4)).toBe(true);
            expect(bucket.consume('user-1', 1)).toBe(false);
        });
    });

    // ─── check() ────────────────────────────────────────────────

    describe('check()', () => {
        it('returns true when tokens available (without consuming)', () => {
            expect(bucket.check('user-1', 5)).toBe(true);
            // Should not consume
            expect(bucket.remaining('user-1')).toBe(10);
        });

        it('returns false when not enough tokens', () => {
            bucket.consume('user-1', 10);
            expect(bucket.check('user-1', 1)).toBe(false);
        });

        it('defaults to checking 1 token', () => {
            expect(bucket.check('user-1')).toBe(true);
        });
    });

    // ─── remaining() ────────────────────────────────────────────

    describe('remaining()', () => {
        it('returns max tokens for new key', () => {
            expect(bucket.remaining('new-key')).toBe(10);
        });

        it('returns floor(tokens) after consumption', () => {
            bucket.consume('user-1', 3);
            expect(bucket.remaining('user-1')).toBe(7);
        });
    });

    // ─── waitTime() ─────────────────────────────────────────────

    describe('waitTime()', () => {
        it('returns 0 when tokens are available', () => {
            expect(bucket.waitTime('user-1', 5)).toBe(0);
        });

        it('calculates wait time in ms', () => {
            bucket.consume('user-1', 10);
            // Need 5 tokens at 2/sec = 2.5 seconds = 2500ms
            const wait = bucket.waitTime('user-1', 5);
            expect(wait).toBe(2500);
        });

        it('defaults to waiting for 1 token', () => {
            bucket.consume('user-1', 10);
            // Need 1 token at 2/sec = 0.5 seconds = 500ms
            expect(bucket.waitTime('user-1')).toBe(500);
        });
    });

    // ─── reset() ────────────────────────────────────────────────

    describe('reset()', () => {
        it('restores tokens to max', () => {
            bucket.consume('user-1', 8);
            expect(bucket.reset('user-1')).toBe(true);
            expect(bucket.remaining('user-1')).toBe(10);
        });

        it('returns false for unknown key', () => {
            expect(bucket.reset('unknown')).toBe(false);
        });
    });

    // ─── configure() ────────────────────────────────────────────

    describe('configure()', () => {
        it('configures a new bucket with custom settings', () => {
            bucket.configure('premium-user', 1000, 50);
            expect(bucket.remaining('premium-user')).toBe(1000);
        });

        it('updates existing bucket settings', () => {
            bucket.consume('user-1', 5);
            bucket.configure('user-1', 20, 5);

            const stats = bucket.getStats('user-1')!;
            expect(stats.max).toBe(20);
        });
    });

    // ─── getStats() ─────────────────────────────────────────────

    describe('getStats()', () => {
        it('returns null for unknown key', () => {
            expect(bucket.getStats('unknown')).toBeNull();
        });

        it('returns tokens, max, consumed, rejected', () => {
            bucket.consume('user-1', 3);

            const stats = bucket.getStats('user-1')!;
            expect(stats.tokens).toBe(7);
            expect(stats.max).toBe(10);
            expect(stats.consumed).toBe(3);
            expect(stats.rejected).toBe(0);
        });
    });

    // ─── remove() ───────────────────────────────────────────────

    describe('remove()', () => {
        it('removes a bucket', () => {
            bucket.consume('user-1', 1);
            expect(bucket.remove('user-1')).toBe(true);
            expect(bucket.getStats('user-1')).toBeNull();
        });

        it('returns false for unknown key', () => {
            expect(bucket.remove('unknown')).toBe(false);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns 0 initially', () => {
            expect(bucket.count()).toBe(0);
        });

        it('returns number of tracked buckets', () => {
            bucket.consume('a', 1);
            bucket.consume('b', 1);
            expect(bucket.count()).toBe(2);
        });
    });

    // ─── Constructor Defaults ───────────────────────────────────

    describe('constructor defaults', () => {
        it('defaults to 100 max, 10/sec refill', () => {
            const defaultBucket = new TokenBucket();
            expect(defaultBucket.remaining('test')).toBe(100);
        });
    });
});
