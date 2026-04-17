/**
 * agents/command-poll-backoff.test.ts
 */
import { describe, it, expect } from 'vitest';
import { computeBackoff, createBackoffTracker, retryWithBackoff } from './command-poll-backoff.js';

describe('Command Poll Backoff', () => {
    describe('computeBackoff', () => {
        it('starts at initialMs', () => {
            const delay = computeBackoff(0, { initialMs: 100, factor: 2, maxMs: 10000, jitter: 0 });
            expect(delay).toBe(100);
        });

        it('increases exponentially', () => {
            const d0 = computeBackoff(0, { initialMs: 100, factor: 2, maxMs: 100000, jitter: 0 });
            const d3 = computeBackoff(3, { initialMs: 100, factor: 2, maxMs: 100000, jitter: 0 });
            expect(d3).toBeGreaterThan(d0);
        });

        it('caps at maxMs', () => {
            const delay = computeBackoff(100, { initialMs: 100, factor: 2, maxMs: 1000, jitter: 0 });
            expect(delay).toBeLessThanOrEqual(1000);
        });
    });

    describe('createBackoffTracker', () => {
        it('tracks state', () => {
            const tracker = createBackoffTracker({ jitter: 0 });
            tracker.next();
            tracker.next();
            const state = tracker.state();
            expect(state.attempt).toBe(2);
            expect(state.totalWaitedMs).toBeGreaterThan(0);
        });

        it('resets', () => {
            const tracker = createBackoffTracker();
            tracker.next();
            tracker.reset();
            expect(tracker.state().attempt).toBe(0);
        });
    });

    describe('retryWithBackoff', () => {
        it('succeeds first try', async () => {
            const result = await retryWithBackoff(async () => 42);
            expect(result).toBe(42);
        });

        it('retries on failure', async () => {
            let attempt = 0;
            const result = await retryWithBackoff(async (a) => {
                attempt = a;
                if (a < 2) throw new Error('fail');
                return 'ok';
            }, { maxAttempts: 3, policy: { initialMs: 10, jitter: 0 } });
            expect(result).toBe('ok');
            expect(attempt).toBe(2);
        });

        it('throws after max attempts', async () => {
            await expect(retryWithBackoff(async () => { throw new Error('always fail'); }, { maxAttempts: 2, policy: { initialMs: 10, jitter: 0 } })).rejects.toThrow('always fail');
        });

        it('respects shouldRetry', async () => {
            let attempts = 0;
            await expect(retryWithBackoff(async () => { attempts++; throw new Error('no'); }, { maxAttempts: 5, shouldRetry: () => false })).rejects.toThrow();
            expect(attempts).toBe(1);
        });
    });
});
