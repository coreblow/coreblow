/**
 * CoreBlow Phase 29 — Chaos & Fault Injection Tests
 *
 * Layer 3 (Resilience):
 *   - Concurrent access: no double-processing, atomic state transitions
 *   - Cascading failure isolation: one subsystem failure doesn't poison others
 *   - State recovery: snapshots, replay, purge-under-load safety
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../../src/infra/task-queue.js';
import { CircuitBreaker } from '../../src/infra/circuit-breaker.js';
import { EventStore } from '../../src/infra/event-sourcing.js';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';
import { WorkflowEngine } from '../../src/infra/workflow-engine.js';
import { HooksEngine } from '../../src/hooks/engine.js';
import { StateMachine } from '../../src/infra/state-machine.js';

// ================================================================
// Concurrent Access
// ================================================================
describe('Phase29 Chaos: Concurrent Access', () => {
    it('concurrent TaskQueue.process() calls — no double-processing', async () => {
        const queue = new TaskQueue(2);
        const executionLog: string[] = [];

        // Enqueue 5 tasks
        for (let i = 0; i < 5; i++) {
            queue.enqueue(`task-${i}`, async () => {
                await new Promise(r => setTimeout(r, 5));
                executionLog.push(`task-${i}`);
                return `result-${i}`;
            });
        }

        // Fire multiple process() calls concurrently
        const results = await Promise.all([
            queue.process(),
            queue.process(),
            queue.process(),
        ]);

        // Only one process() call should have actually worked (processing guard)
        const totalProcessed = results.reduce((a, b) => a + b, 0);
        // The first call processes tasks; subsequent calls return 0 because processing flag is set
        expect(totalProcessed).toBeGreaterThan(0);

        // No task should appear more than once
        const uniqueTasks = new Set(executionLog);
        expect(uniqueTasks.size).toBe(executionLog.length);
    });

    it('CircuitBreaker under rapid fire — state transitions are consistent', async () => {
        const cb = new CircuitBreaker();
        const errors: Error[] = [];

        // Fire 20 rapid concurrent calls, half succeed half fail
        const promises = Array.from({ length: 20 }, (_, i) =>
            cb.execute('rapid-svc', async () => {
                if (i % 2 === 0) throw new Error(`fail-${i}`);
                return `ok-${i}`;
            }, { failureThreshold: 8, resetTimeoutMs: 100 }).catch(err => {
                errors.push(err as Error);
                return null;
            })
        );

        await Promise.all(promises);

        // State should be deterministic — either closed or open
        const state = cb.getState('rapid-svc');
        expect(['closed', 'open']).toContain(state);

        // Stats should be internally consistent
        const stats = cb.getStats('rapid-svc')!;
        expect(stats.failures + stats.successes).toBeLessThanOrEqual(stats.totalCalls);
    });

    it('EventStore concurrent appends — version numbering remains sequential', async () => {
        const store = new EventStore();

        // Append 50 events concurrently to the same aggregate
        const promises = Array.from({ length: 50 }, (_, i) =>
            Promise.resolve(store.append('update', 'shared-agg', { index: i }))
        );

        await Promise.all(promises);

        // Versions should be sequential 1..50
        const events = store.getEvents('shared-agg');
        expect(events).toHaveLength(50);

        const versions = events.map(e => e.version);
        for (let i = 0; i < versions.length; i++) {
            expect(versions[i]).toBe(i + 1);
        }

        expect(store.getVersion('shared-agg')).toBe(50);
    });

    it('HooksEngine concurrent emit — shared context isolation between events', async () => {
        const hooks = new HooksEngine();
        const results: Array<{ event: string; sharedKeys: string[] }> = [];

        hooks.register({
            id: 'context-writer',
            name: 'context-writer',
            source: 'bundled',
            metadata: { events: ['event:*'] },
            handler: async (ctx) => {
                // Each event writes its own key to shared context
                ctx.shared[ctx.event] = true;
                // Small delay to allow interleaving
                await new Promise(r => setTimeout(r, 2));
                results.push({
                    event: ctx.event,
                    sharedKeys: Object.keys(ctx.shared),
                });
            },
            enabled: true,
        });

        // Fire 3 events concurrently
        await Promise.all([
            hooks.emit('event:a', {}),
            hooks.emit('event:b', {}),
            hooks.emit('event:c', {}),
        ]);

        // Each event should have its own isolated shared context
        // (HooksEngine creates a new ctx per emit call)
        for (const r of results) {
            expect(r.sharedKeys).toHaveLength(1);
            expect(r.sharedKeys[0]).toBe(r.event);
        }
    });
});

// ================================================================
// Cascading Failure Isolation
// ================================================================
describe('Phase29 Chaos: Cascading Failure Isolation', () => {
    it('one MessageBroker queue fails → other queues unaffected', async () => {
        const broker = new MessageBroker();

        // Queue A: always fails
        broker.publish('queue-a', { data: 'a' }, 0, 1);
        broker.subscribe('queue-a', async () => { throw new Error('queue-a broken'); });

        // Queue B: always succeeds
        broker.publish('queue-b', { data: 'b' });
        broker.subscribe('queue-b', async () => true);

        // Process both
        const resultA = await broker.processNext('queue-a');
        const resultB = await broker.processNext('queue-b');

        // Queue A failed but Queue B succeeded independently
        expect(resultA!.status).toBe('failed');
        expect(resultB!.status).toBe('completed');

        // Stats reflect isolation
        expect(broker.getStats().failed).toBe(1);
        expect(broker.getStats().consumed).toBe(1);
    });

    it('CircuitBreaker for service A opens → service B remains closed', async () => {
        const cb = new CircuitBreaker();

        // Trip circuit for service-a
        for (let i = 0; i < 5; i++) {
            try {
                await cb.execute('service-a', async () => { throw new Error('down'); });
            } catch { /* expected */ }
        }

        // service-b should be completely unaffected
        const resultB = await cb.execute('service-b', async () => 'healthy');

        expect(cb.getState('service-a')).toBe('open');
        expect(cb.getState('service-b')).toBe('closed');
        expect(resultB).toBe('healthy');

        // Verify isolation in list
        const circuits = cb.list();
        expect(circuits).toHaveLength(2);
        expect(circuits.find(c => c.key === 'service-a')!.state).toBe('open');
        expect(circuits.find(c => c.key === 'service-b')!.state).toBe('closed');
    });

    it('WorkflowEngine step failure with skip → subsequent steps execute normally', async () => {
        const engine = new WorkflowEngine();
        const executed: string[] = [];

        engine.register({
            id: 'resilient-flow',
            name: 'Resilient',
            steps: [
                {
                    id: 'step-1',
                    name: 'Success',
                    handler: async () => { executed.push('step-1'); return 'ok'; },
                },
                {
                    id: 'step-2-crash',
                    name: 'Crash',
                    handler: async () => { throw new Error('unexpected crash'); },
                    onError: 'skip',
                },
                {
                    id: 'step-3',
                    name: 'After Crash',
                    handler: async () => { executed.push('step-3'); return 'recovered'; },
                },
                {
                    id: 'step-4',
                    name: 'Final',
                    handler: async () => { executed.push('step-4'); return 'done'; },
                },
            ],
        });

        const result = await engine.execute('resilient-flow');
        expect(result.status).toBe('partial');
        expect(result.stepsExecuted).toBe(3); // 1, 3, 4
        expect(result.stepsSkipped).toBe(1); // 2
        expect(executed).toEqual(['step-1', 'step-3', 'step-4']);
    });
});

// ================================================================
// State Recovery
// ================================================================
describe('Phase29 Chaos: State Recovery', () => {
    it('EventStore snapshot + replay produces identical state', () => {
        const store = new EventStore();

        // Register a shopping cart projection
        store.registerProjection('cart', (state, event) => {
            const items = (state.items as string[] | undefined) ?? [];
            if (event.type === 'item:added') return { ...state, items: [...items, event.payload.item] };
            if (event.type === 'item:removed') return { ...state, items: items.filter(i => i !== event.payload.item) };
            return state;
        });

        // Build event history
        store.append('item:added', 'cart-1', { item: 'widget' });
        store.append('item:added', 'cart-1', { item: 'gadget' });
        store.append('item:added', 'cart-1', { item: 'doohickey' });
        store.append('item:removed', 'cart-1', { item: 'gadget' });

        // Project state from events
        const state1 = store.project('cart', 'cart-1');
        expect(state1.items).toEqual(['widget', 'doohickey']);

        // Create snapshot at this point
        store.createSnapshot('cart-1', { ...state1 });

        // Add more events
        store.append('item:added', 'cart-1', { item: 'thingamajig' });

        // Project from snapshot — should include post-snapshot events
        const state2 = store.project('cart', 'cart-1');
        expect(state2.items).toEqual(['widget', 'doohickey', 'thingamajig']);
    });

    it('StateMachine can be recreated by replaying transitions from history', () => {
        const sm = new StateMachine();
        sm.define({
            id: 'order',
            initialState: 'draft',
            states: ['draft', 'submitted', 'approved', 'shipped'],
            transitions: [
                { from: 'draft', to: 'submitted', event: 'submit' },
                { from: 'submitted', to: 'approved', event: 'approve' },
                { from: 'approved', to: 'shipped', event: 'ship' },
            ],
        });

        // Original instance — go through full lifecycle
        const original = sm.create('order')!;
        sm.send(original.id, 'submit');
        sm.send(original.id, 'approve');
        sm.send(original.id, 'ship');

        // Capture history
        const history = sm.getInstance(original.id)!.history;
        expect(history).toHaveLength(3);

        // Recreate by replaying history on a fresh instance
        const replica = sm.create('order')!;
        for (const record of history) {
            const result = sm.send(replica.id, record.event);
            expect(result.success).toBe(true);
        }

        // Both should be at the same state
        expect(sm.getState(replica.id)).toBe(sm.getState(original.id));
        expect(sm.getState(replica.id)).toBe('shipped');
    });

    it('DeadLetterQueue purge during active operations — no corruption', async () => {
        const dlq = new DeadLetterQueue();

        // Add entries in batches with small delays
        for (let i = 0; i < 10; i++) {
            dlq.add('queue-a', { index: i }, `error-${i}`, 1);
        }

        // Small delay so first batch is "old"
        await new Promise(r => setTimeout(r, 15));

        // Add fresh entries
        for (let i = 10; i < 20; i++) {
            dlq.add('queue-b', { index: i }, `error-${i}`, 1);
        }

        // Purge old entries while fresh entries exist
        const purged = dlq.purge(10);
        expect(purged).toBe(10); // First batch purged

        // Fresh entries should still be intact
        const remaining = dlq.getByQueue('queue-b');
        expect(remaining).toHaveLength(10);
        expect(dlq.count()).toBe(10);

        // Summary should only show queue-b
        const summary = dlq.summary();
        expect(summary).toHaveLength(1);
        expect(summary[0]!.queue).toBe('queue-b');
    });
});
