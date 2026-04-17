/**
 * CoreBlow Phase 29 — Resilience Subsystem Unit Tests
 *
 * Layer 1 (Class Contract) for:
 *   - RetryPolicy: exponential backoff, jitter, presets, conditional retry
 *   - DeadLetterQueue: add, filter, purge, mark-retried, summary
 *   - CircuitBreaker: half-open recovery path (extends phase29-workflow.test.ts)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RetryPolicy } from '../../src/infra/retry-policy.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';
import { CircuitBreaker } from '../../src/infra/circuit-breaker.js';

// ================================================================
// RetryPolicy
// ================================================================
describe('RetryPolicy', () => {
    let policy: RetryPolicy;

    beforeEach(() => {
        // Use zero-delay for fast tests
        policy = new RetryPolicy({ baseDelayMs: 0, maxDelayMs: 0, jitter: false });
    });

    it('should succeed on first attempt', async () => {
        const result = await policy.execute(async () => 'ok');
        expect(result.success).toBe(true);
        expect(result.data).toBe('ok');
        expect(result.attempts).toBe(1);
    });

    it('should retry and succeed on later attempt', async () => {
        let calls = 0;
        const result = await policy.execute(async () => {
            calls++;
            if (calls < 3) throw new Error('transient');
            return 'recovered';
        });
        expect(result.success).toBe(true);
        expect(result.data).toBe('recovered');
        expect(result.attempts).toBe(3);
    });

    it('should fail after all retries exhausted', async () => {
        const result = await policy.execute(
            async () => { throw new Error('permanent'); },
            { maxRetries: 2 },
        );
        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('permanent');
        expect(result.attempts).toBe(3); // 1 initial + 2 retries
    });

    it('should respect retryOn conditional filter', async () => {
        let calls = 0;
        const result = await policy.execute(
            async () => { calls++; throw new Error('non-retryable'); },
            { maxRetries: 5, retryOn: () => false },
        );
        expect(result.success).toBe(false);
        expect(calls).toBe(1); // No retries because retryOn returns false
    });

    it('should track stats correctly', async () => {
        await policy.execute(async () => 'ok');
        await policy.execute(async () => { throw new Error('fail'); }, { maxRetries: 0 });

        const stats = policy.getStats();
        expect(stats.totalCalls).toBe(2);
        expect(stats.totalSuccess).toBe(1);
        expect(stats.totalFailed).toBe(1);
    });

    it('should reset stats', async () => {
        await policy.execute(async () => 'ok');
        policy.resetStats();
        const stats = policy.getStats();
        expect(stats.totalCalls).toBe(0);
        expect(stats.totalSuccess).toBe(0);
    });

    it('should create aggressive preset', () => {
        const aggressive = RetryPolicy.aggressive();
        expect(aggressive).toBeInstanceOf(RetryPolicy);
    });

    it('should create conservative preset', () => {
        const conservative = RetryPolicy.conservative();
        expect(conservative).toBeInstanceOf(RetryPolicy);
    });

    it('should create noRetry preset and fail immediately', async () => {
        const noRetry = RetryPolicy.noRetry();
        const result = await noRetry.execute(async () => { throw new Error('fail'); });
        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
    });
});

// ================================================================
// DeadLetterQueue
// ================================================================
describe('DeadLetterQueue', () => {
    let dlq: DeadLetterQueue;

    beforeEach(() => {
        dlq = new DeadLetterQueue();
    });

    it('should add dead letters', () => {
        const dl = dlq.add('orders', { id: 1 }, 'timeout', 3);
        expect(dl.id).toMatch(/^dl-/);
        expect(dl.originalQueue).toBe('orders');
        expect(dl.error).toBe('timeout');
        expect(dl.attempts).toBe(3);
        expect(dl.retried).toBe(false);
        expect(dlq.count()).toBe(1);
    });

    it('should filter by queue name', () => {
        dlq.add('orders', {}, 'err1', 1);
        dlq.add('emails', {}, 'err2', 1);
        dlq.add('orders', {}, 'err3', 2);

        expect(dlq.getByQueue('orders')).toHaveLength(2);
        expect(dlq.getByQueue('emails')).toHaveLength(1);
        expect(dlq.getByQueue('none')).toHaveLength(0);
    });

    it('should mark as retried', () => {
        const dl = dlq.add('q1', {}, 'err', 1);
        expect(dlq.markRetried(dl.id)).toBe(true);

        const unretried = dlq.getUnretried();
        expect(unretried).toHaveLength(0);
    });

    it('should return false when marking non-existent entry', () => {
        expect(dlq.markRetried('dl-999')).toBe(false);
    });

    it('should get unretried entries only', () => {
        const dl1 = dlq.add('q1', {}, 'e1', 1);
        dlq.add('q1', {}, 'e2', 1);
        dlq.markRetried(dl1.id);

        expect(dlq.getUnretried()).toHaveLength(1);
    });

    it('should purge old entries by time', async () => {
        dlq.add('q1', {}, 'old', 1);
        // Wait a tiny bit
        await new Promise(r => setTimeout(r, 15));
        dlq.add('q1', {}, 'new', 1);

        const purged = dlq.purge(10); // Purge items older than 10ms
        expect(purged).toBe(1);
        expect(dlq.count()).toBe(1);
    });

    it('should produce correct summary', () => {
        dlq.add('orders', {}, 'e1', 1);
        dlq.add('orders', {}, 'e2', 1);
        const dl = dlq.add('emails', {}, 'e3', 1);
        dlq.markRetried(dl.id);

        const summary = dlq.summary();
        expect(summary).toHaveLength(2);

        const ordersSummary = summary.find(s => s.queue === 'orders')!;
        expect(ordersSummary.count).toBe(2);
        expect(ordersSummary.unretried).toBe(2);

        const emailsSummary = summary.find(s => s.queue === 'emails')!;
        expect(emailsSummary.count).toBe(1);
        expect(emailsSummary.unretried).toBe(0); // was marked retried
    });
});

// ================================================================
// CircuitBreaker — Half-Open Recovery Path
// ================================================================
describe('CircuitBreaker — Half-Open Recovery', () => {
    let cb: CircuitBreaker;

    beforeEach(() => {
        cb = new CircuitBreaker();
    });

    it('should transition from open to half-open after resetTimeout', async () => {
        // Open the circuit with 5 failures (using very short resetTimeout)
        for (let i = 0; i < 5; i++) {
            try {
                await cb.execute('api', async () => { throw new Error('fail'); }, {
                    failureThreshold: 5,
                    resetTimeoutMs: 10,
                    halfOpenMaxCalls: 2,
                });
            } catch { /* expected */ }
        }
        expect(cb.getState('api')).toBe('open');

        // Wait for resetTimeout to elapse
        await new Promise(r => setTimeout(r, 20));

        // Next getState check should transition to half-open
        expect(cb.getState('api')).toBe('half-open');
    });

    it('should close circuit after successful half-open calls', async () => {
        // Open the circuit
        for (let i = 0; i < 5; i++) {
            try {
                await cb.execute('api', async () => { throw new Error('fail'); }, {
                    failureThreshold: 5,
                    resetTimeoutMs: 10,
                    halfOpenMaxCalls: 2,
                });
            } catch { /* expected */ }
        }

        // Wait for half-open transition
        await new Promise(r => setTimeout(r, 20));

        // Successful calls in half-open state
        await cb.execute('api', async () => 'ok', { halfOpenMaxCalls: 2 });
        await cb.execute('api', async () => 'ok', { halfOpenMaxCalls: 2 });

        expect(cb.getState('api')).toBe('closed');
    });

    it('should re-open circuit on failure during half-open', async () => {
        // Open the circuit
        for (let i = 0; i < 5; i++) {
            try {
                await cb.execute('api', async () => { throw new Error('fail'); }, {
                    failureThreshold: 5,
                    resetTimeoutMs: 10,
                    halfOpenMaxCalls: 3,
                });
            } catch { /* expected */ }
        }

        // Wait for half-open
        await new Promise(r => setTimeout(r, 20));
        expect(cb.getState('api')).toBe('half-open');

        // Fail during half-open
        try {
            await cb.execute('api', async () => { throw new Error('still failing'); }, {
                failureThreshold: 5,
            });
        } catch { /* expected */ }

        expect(cb.getState('api')).toBe('open');
    });
});
