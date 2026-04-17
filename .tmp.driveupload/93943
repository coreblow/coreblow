/**
 * CoreBlow Phase 29 — Resilience Chain Integration Tests
 *
 * Layer 2 (Pipeline Orchestration):
 *   TaskQueue → CircuitBreaker → RetryPolicy → DeadLetterQueue
 *
 * Tests the full resilience pipeline as it would execute in production:
 *   1. Tasks enqueued → protected by CircuitBreaker
 *   2. Failures retried by RetryPolicy
 *   3. Exhausted tasks land in DeadLetterQueue
 *   4. Circuit recovery re-enables task processing
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../../src/infra/task-queue.js';
import { CircuitBreaker } from '../../src/infra/circuit-breaker.js';
import { RetryPolicy } from '../../src/infra/retry-policy.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase29 Chain: Resilience Pipeline', () => {
    let queue: TaskQueue;
    let breaker: CircuitBreaker;
    let retry: RetryPolicy;
    let dlq: DeadLetterQueue;
    let events: EventStore;

    beforeEach(() => {
        queue = new TaskQueue(5);
        breaker = new CircuitBreaker();
        retry = new RetryPolicy({ baseDelayMs: 0, maxDelayMs: 0, jitter: false, maxRetries: 2 });
        dlq = new DeadLetterQueue();
        events = new EventStore();
    });

    // ── Happy Path ──

    it('TaskQueue → CircuitBreaker → success → EventStore audit trail', async () => {
        // Enqueue a task that executes through circuit breaker
        queue.enqueue('api-call', async () => {
            const result = await breaker.execute('api-service', async () => 'response-ok');
            events.append('task:completed', 'pipeline', { result });
            return result;
        });

        const processed = await queue.process();
        expect(processed).toBe(1);

        // Verify audit trail in EventStore
        const trail = events.getEvents('pipeline');
        expect(trail).toHaveLength(1);
        expect(trail[0]!.type).toBe('task:completed');
        expect(trail[0]!.payload.result).toBe('response-ok');

        // CircuitBreaker should remain closed
        expect(breaker.getState('api-service')).toBe('closed');
    });

    it('TaskQueue respects priority when routing through CircuitBreaker', async () => {
        const order: string[] = [];

        queue.enqueue('low-priority', async () => {
            await breaker.execute('svc', async () => { order.push('low'); return 'low'; });
        }, 1);

        queue.enqueue('high-priority', async () => {
            await breaker.execute('svc', async () => { order.push('high'); return 'high'; });
        }, 10);

        queue.enqueue('mid-priority', async () => {
            await breaker.execute('svc', async () => { order.push('mid'); return 'mid'; });
        }, 5);

        await queue.process();
        expect(order).toEqual(['high', 'mid', 'low']);
    });

    it('successful execution records stats across all subsystems', async () => {
        queue.enqueue('tracked', async () => {
            const retryResult = await retry.execute(async () => {
                return await breaker.execute('api', async () => 42);
            });
            events.append('task:result', 'stats-agg', { value: retryResult.data });
        });

        await queue.process();

        expect(queue.getStats().completed).toBe(1);
        expect(breaker.getStats('api')?.successes).toBe(1);
        expect(retry.getStats().totalSuccess).toBe(1);
        expect(events.count()).toBe(1);
    });

    // ── Failure Path ──

    it('CircuitBreaker opens → tasks fail → DeadLetterQueue receives them', async () => {
        // First, trip the circuit breaker with 5 direct failures
        for (let i = 0; i < 5; i++) {
            try {
                await breaker.execute('fragile-api', async () => { throw new Error('down'); });
            } catch { /* expected */ }
        }
        expect(breaker.getState('fragile-api')).toBe('open');

        // Now enqueue a task that tries to use the open circuit
        queue.enqueue('doomed-task', async () => {
            try {
                await breaker.execute('fragile-api', async () => 'should-not-reach');
            } catch (err) {
                // Circuit is open — redirect to DLQ
                dlq.add('task-queue', { task: 'doomed-task' }, (err as Error).message, 1);
                throw err; // Re-throw so TaskQueue marks it failed
            }
        }, 0, 0); // 0 retries

        await queue.process();

        expect(queue.getDeadLetter()).toHaveLength(1);
        expect(dlq.count()).toBe(1);
        expect(dlq.getByQueue('task-queue')[0]!.error).toContain('Circuit');
    });

    it('RetryPolicy retries within CircuitBreaker threshold without tripping', async () => {
        let callCount = 0;

        queue.enqueue('flaky-task', async () => {
            const result = await retry.execute(async () => {
                return await breaker.execute('flaky-svc', async () => {
                    callCount++;
                    if (callCount < 3) throw new Error('transient');
                    return 'recovered';
                }, { failureThreshold: 5 }); // High threshold so circuit stays closed
            });
            events.append('task:recovered', 'recovery', { attempts: result.attempts });
            return result.data;
        });

        await queue.process();

        // RetryPolicy handled the retries
        expect(retry.getStats().totalRetries).toBeGreaterThan(0);
        expect(retry.getStats().totalSuccess).toBe(1);
        // CircuitBreaker stayed closed (failures < threshold)
        expect(breaker.getState('flaky-svc')).toBe('closed');
        // Audit trail recorded
        expect(events.getEvents('recovery')).toHaveLength(1);
    });

    it('RetryPolicy exhausted → CircuitBreaker trips → DLQ captures', async () => {
        queue.enqueue('permanent-fail', async () => {
            const result = await retry.execute(async () => {
                return await breaker.execute('dying-svc', async () => {
                    throw new Error('permanent');
                }, { failureThreshold: 5 });
            }, { maxRetries: 4 }); // 5 total attempts = trips the circuit

            if (!result.success) {
                dlq.add('resilience-pipeline', { task: 'permanent-fail' }, result.error!.message, result.attempts);
                events.append('task:failed', 'pipeline', { error: result.error!.message, attempts: result.attempts });
            }
        });

        await queue.process();

        // Circuit should be open after 5 failures
        expect(breaker.getState('dying-svc')).toBe('open');
        // DLQ should have the failed task
        expect(dlq.count()).toBe(1);
        expect(dlq.getByQueue('resilience-pipeline')[0]!.attempts).toBe(5);
        // EventStore has the failure audit
        expect(events.getByType('task:failed')).toHaveLength(1);
    });

    // ── Recovery Path ──

    it('CircuitBreaker recovery → TaskQueue resumes → DLQ items retried', async () => {
        // Phase 1: Trip the circuit
        for (let i = 0; i < 5; i++) {
            try {
                await breaker.execute('recovering-api', async () => { throw new Error('down'); }, {
                    failureThreshold: 5, resetTimeoutMs: 10, halfOpenMaxCalls: 1,
                });
            } catch { /* expected */ }
        }
        expect(breaker.getState('recovering-api')).toBe('open');

        // Phase 2: Store failed work in DLQ
        const failedDL = dlq.add('main-queue', { data: 'important' }, 'Circuit open', 5);

        // Phase 3: Wait for half-open
        await new Promise(r => setTimeout(r, 20));
        expect(breaker.getState('recovering-api')).toBe('half-open');

        // Phase 4: Enqueue DLQ retry through recovered circuit
        queue.enqueue('dlq-retry', async () => {
            const result = await breaker.execute('recovering-api', async () => 'service-restored', {
                failureThreshold: 5, resetTimeoutMs: 10, halfOpenMaxCalls: 1,
            });
            dlq.markRetried(failedDL.id);
            events.append('dlq:retried', 'recovery', { originalId: failedDL.id, result });
            return result;
        });

        await queue.process();

        // Verify recovery chain
        expect(breaker.getState('recovering-api')).toBe('closed');
        expect(dlq.getUnretried()).toHaveLength(0);
        expect(events.getByType('dlq:retried')).toHaveLength(1);
    });

    it('EventStore snapshot enables state reconstruction after failure', () => {
        // Build up event history
        events.append('task:started', 'job-1', { name: 'export' });
        events.append('task:progress', 'job-1', { percent: 50 });
        events.append('task:completed', 'job-1', { percent: 100, output: 'file.csv' });

        // Create snapshot at current version
        events.createSnapshot('job-1', { name: 'export', percent: 100, output: 'file.csv' });

        // Add more events after snapshot
        events.append('task:archived', 'job-1', { archivedAt: Date.now() });

        // Projection from snapshot should include post-snapshot events
        events.registerProjection('job-state', (state, event) => {
            return { ...state, ...event.payload, lastEvent: event.type };
        });

        const finalState = events.project('job-state', 'job-1');
        expect(finalState.lastEvent).toBe('task:archived');
        expect(finalState.output).toBe('file.csv'); // From snapshot
    });
});
