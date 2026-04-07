// @ts-nocheck
/**
 * Integration Test Suite 3: Resiliency Guard
 *
 * Verifies: RateLimiter + Debounce/Throttle → CircuitBreaker → ErrorBoundary → NotificationSystem → I18n → RuntimeGuard
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../infra/rate-limiter.js';
import { CircuitBreaker } from '../infra/circuit-breaker.js';
import { ErrorBoundary } from '../infra/error-boundary.js';
import { NotificationSystem } from '../infra/notification-system.js';
import { I18n } from '../infra/i18n.js';
import { DeadLetterQueue } from '../infra/dead-letter-queue.js';
import { debounce, throttle } from '../infra/debounce-throttle.js';
import { detectRuntime, runtimeSatisfies } from '../infra/runtime-guard.js';

describe('Integration: Resiliency Guard', () => {
    let limiter: RateLimiter;
    let cb: CircuitBreaker;
    let boundary: ErrorBoundary;
    let notify: NotificationSystem;
    let i18n: I18n;
    let dlq: DeadLetterQueue;

    beforeEach(() => {
        limiter = new RateLimiter();
        cb = new CircuitBreaker();
        boundary = new ErrorBoundary();
        notify = new NotificationSystem();
        i18n = new I18n();
        dlq = new DeadLetterQueue();
    });

    it('rate limiter prevents excess requests to circuit breaker', async () => {
        const rateConfig = { maxTokens: 2, refillRate: 0 }; // no refill → strict 2 calls
        let apiCalls = 0;

        for (let i = 0; i < 5; i++) {
            if (limiter.allow('api', rateConfig)) {
                await cb.execute('svc', async () => { apiCalls++; return 'ok'; });
            }
        }

        expect(apiCalls).toBe(2); // only 2 passed rate limit
        expect(cb.getStats('svc')!.totalCalls).toBe(2);
    });

    it('throttle protects downstream from burst calls', async () => {
        let calls = 0;
        const throttled = throttle(async () => ++calls, 30);

        // Rapid burst
        await throttled();
        await throttled();
        await throttled();

        expect(calls).toBe(1); // only 1 executed, rest returned cached result

        // Wait for throttle window to expire
        await new Promise(r => setTimeout(r, 50));
        await throttled();
        expect(calls).toBe(2); // fresh call after window
    });

    it('circuit open → error boundary classifies → notification sent', async () => {
        const fail = async () => { throw new Error('upstream timeout'); };

        // Trip circuit
        await expect(cb.execute('api', fail, { failureThreshold: 1 })).rejects.toThrow();

        // Next call: circuit is open
        try {
            await cb.execute('api', async () => 'ok');
        } catch (err) {
            // Classify the error
            const structured = boundary.classify(err instanceof Error ? err : new Error(String(err)));
            boundary.handle(structured);

            // Send admin notification with localized message
            const msg = i18n.t('error.internal');
            notify.send('error', 'Circuit Tripped', `${msg}: ${structured.message}`, 'admin');
        }

        // Verify the chain
        expect(boundary.getErrorCounts()['internal']).toBe(1);
        const adminNotifs = notify.getForUser('admin');
        expect(adminNotifs).toHaveLength(1);
        expect(adminNotifs[0].title).toBe('Circuit Tripped');
        expect(adminNotifs[0].message).toContain('Internal server error');
    });

    it('runtime guard validates before execution', async () => {
        const runtime = detectRuntime();

        if (runtimeSatisfies(runtime)) {
            // Runtime is supported → execute normally
            const result = await cb.execute('guarded', async () => 'processed');
            expect(result).toBe('processed');
        } else {
            // Runtime unsupported → send notification
            notify.send('warning', 'Unsupported Runtime', `Node ${runtime.version} is below minimum`, 'admin');
        }

        // In test env (Node 22+), runtime should be supported
        expect(runtimeSatisfies(runtime)).toBe(true);
        expect(cb.getStats('guarded')!.successes).toBe(1);
    });

    it('debounce + rate limiter: burst resolves to single execution', async () => {
        let execCount = 0;
        const rateConfig = { maxTokens: 3, refillRate: 0 };

        const debouncedAction = debounce(async (val: string) => {
            if (limiter.allow('debounced', rateConfig)) {
                execCount++;
                return `done-${val}`;
            }
            return 'rate-limited';
        }, 15);

        // Fire 3 rapid calls — debounce collapses to 1
        debouncedAction('a').catch(() => {});
        debouncedAction('b').catch(() => {});
        const result = await debouncedAction('c'); // only this one fires

        await new Promise(r => setTimeout(r, 25));

        expect(execCount).toBe(1);
        expect(result).toBe('done-c');
    });

    it('localized admin notification when circuit trips', async () => {
        // Switch to Indonesian
        i18n.setLocale('id');

        // Trip the circuit
        const fail = async () => { throw new Error('connection refused'); };
        await expect(cb.execute('downstream', fail, { failureThreshold: 1 })).rejects.toThrow();

        // Build localized notification
        const errMsg = i18n.t('error.internal'); // "Kesalahan server internal"
        notify.send('error', 'Sirkuit Terputus', errMsg, 'admin');

        const notifs = notify.getForUser('admin');
        expect(notifs).toHaveLength(1);
        expect(notifs[0].message).toBe('Kesalahan server internal');
        expect(notifs[0].type).toBe('error');
    });

    it('full resiliency chain: request → rate limit → circuit → error → DLQ → notification', async () => {
        const rateConfig = { maxTokens: 5, refillRate: 0 };
        let successCount = 0;
        let failCount = 0;

        // Simulate 8 requests: 5 pass rate limit, but service fails after 2 successes
        let callNum = 0;
        for (let i = 0; i < 8; i++) {
            if (!limiter.allow('chain', rateConfig)) {
                continue; // rate limited
            }

            callNum++;
            try {
                await cb.execute('chain-svc', async () => {
                    if (callNum > 2) throw new Error('service overloaded');
                    return 'ok';
                }, { failureThreshold: 2 });
                successCount++;
            } catch (err) {
                failCount++;
                const structured = boundary.classify(err instanceof Error ? err : new Error(String(err)));
                boundary.handle(structured);

                // After circuit opens, move to DLQ
                if (cb.getState('chain-svc') === 'open') {
                    dlq.add('chain-svc', { requestId: i }, structured.message, 1);
                }
            }
        }

        // Verify results
        expect(successCount).toBe(2);  // 2 succeeded
        expect(failCount).toBe(3);     // 3 failed (call 3,4 fail + circuit opens, call 5 instant reject)
        expect(dlq.count()).toBeGreaterThan(0); // failures captured
        expect(boundary.getRecentErrors().length).toBeGreaterThan(0);

        // Admin notification summary
        const counts = boundary.getErrorCounts();
        const totalErrors = Object.values(counts).reduce((a, b) => a + b, 0);
        notify.send('error', 'System Alert', `${totalErrors} errors detected`, 'admin');

        expect(notify.getForUser('admin')).toHaveLength(1);
    });
});
