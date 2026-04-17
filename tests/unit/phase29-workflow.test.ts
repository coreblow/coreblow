/**
 * CoreBlow Phase 29 — Workflow & Automation Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/infra/workflow-engine.js';
import { TaskQueue } from '../../src/infra/task-queue.js';
import { EventStore } from '../../src/infra/event-sourcing.js';
import { StateMachine } from '../../src/infra/state-machine.js';
import { CircuitBreaker } from '../../src/infra/circuit-breaker.js';

// ================================================================
describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;
    beforeEach(() => { engine = new WorkflowEngine(); });

    it('should register workflows', () => {
        engine.register({ id: 'w1', name: 'Test', steps: [] });
        expect(engine.count()).toBe(1);
    });

    it('should execute workflows', async () => {
        engine.register({ id: 'w1', name: 'Test', steps: [
            { id: 's1', name: 'Step 1', handler: async (ctx) => { ctx.data.done = true; return 'ok'; } },
        ] });
        const result = await engine.execute('w1');
        expect(result.status).toBe('completed');
        expect(result.stepsExecuted).toBe(1);
    });

    it('should handle conditional steps', async () => {
        engine.register({ id: 'w1', name: 'Test', steps: [
            { id: 's1', name: 'Skip', handler: async () => {}, condition: () => false },
        ] });
        const result = await engine.execute('w1');
        expect(result.stepsSkipped).toBe(1);
    });

    it('should handle errors with stop', async () => {
        engine.register({ id: 'w1', name: 'Test', steps: [
            { id: 's1', name: 'Fail', handler: async () => { throw new Error('boom'); }, onError: 'stop' },
            { id: 's2', name: 'Never', handler: async () => {} },
        ] });
        const result = await engine.execute('w1');
        expect(result.status).toBe('failed');
    });

    it('should handle errors with skip', async () => {
        engine.register({ id: 'w1', name: 'Test', steps: [
            { id: 's1', name: 'Fail', handler: async () => { throw new Error('boom'); }, onError: 'skip' },
            { id: 's2', name: 'OK', handler: async () => 'done' },
        ] });
        const result = await engine.execute('w1');
        expect(result.status).toBe('partial');
        expect(result.stepsExecuted).toBe(1);
    });

    it('should list workflows', () => {
        engine.register({ id: 'w1', name: 'A', steps: [{ id: 's1', name: 'S', handler: async () => {} }] });
        expect(engine.list()).toHaveLength(1);
    });
});

// ================================================================
describe('TaskQueue', () => {
    let queue: TaskQueue;
    beforeEach(() => { queue = new TaskQueue(2); });

    it('should enqueue tasks', () => {
        queue.enqueue('task1', async () => 'done');
        expect(queue.count()).toBe(1);
    });

    it('should process tasks', async () => {
        queue.enqueue('t1', async () => 'a');
        queue.enqueue('t2', async () => 'b');
        const processed = await queue.process();
        expect(processed).toBe(2);
    });

    it('should prioritize', () => {
        queue.enqueue('low', async () => {}, 1);
        queue.enqueue('high', async () => {}, 10);
        const stats = queue.getStats();
        expect(stats.pending).toBe(2);
    });

    it('should handle failures to dead letter', async () => {
        queue.enqueue('fail', async () => { throw new Error('oops'); }, 0, 0);
        await queue.process();
        expect(queue.getDeadLetter()).toHaveLength(1);
    });

    it('should get stats', () => {
        queue.enqueue('t', async () => {});
        const stats = queue.getStats();
        expect(stats.pending).toBe(1);
    });
});

// ================================================================
describe('EventStore', () => {
    let store: EventStore;
    beforeEach(() => { store = new EventStore(); });

    it('should append events', () => {
        store.append('created', 'user-1', { name: 'Alice' });
        expect(store.count()).toBe(1);
    });

    it('should get events by aggregate', () => {
        store.append('created', 'user-1', { name: 'Alice' });
        store.append('updated', 'user-1', { name: 'Bob' });
        store.append('created', 'user-2', { name: 'Carol' });
        expect(store.getEvents('user-1')).toHaveLength(2);
    });

    it('should track versions', () => {
        store.append('a', 'agg-1', {});
        store.append('b', 'agg-1', {});
        expect(store.getVersion('agg-1')).toBe(2);
    });

    it('should project state', () => {
        store.registerProjection('counter', (state, event) => {
            return { count: ((state.count as number) ?? 0) + (event.payload.amount as number ?? 0) };
        });
        store.append('add', 'counter-1', { amount: 5 });
        store.append('add', 'counter-1', { amount: 3 });
        const state = store.project('counter', 'counter-1');
        expect(state.count).toBe(8);
    });

    it('should create snapshots', () => {
        store.append('a', 'agg-1', {});
        store.createSnapshot('agg-1', { val: 42 });
        store.registerProjection('pass', (state) => state);
        const state = store.project('pass', 'agg-1');
        expect(state.val).toBe(42);
    });

    it('should get by type', () => {
        store.append('login', 'u1', {});
        store.append('login', 'u2', {});
        store.append('logout', 'u1', {});
        expect(store.getByType('login')).toHaveLength(2);
    });
});

// ================================================================
describe('StateMachine', () => {
    let sm: StateMachine;
    beforeEach(() => {
        sm = new StateMachine();
        sm.define({ id: 'order', initialState: 'draft', states: ['draft', 'submitted', 'approved', 'rejected'], transitions: [
            { from: 'draft', to: 'submitted', event: 'submit' },
            { from: 'submitted', to: 'approved', event: 'approve' },
            { from: 'submitted', to: 'rejected', event: 'reject' },
        ] });
    });

    it('should create instances', () => {
        const inst = sm.create('order');
        expect(inst?.currentState).toBe('draft');
    });

    it('should transition states', () => {
        const inst = sm.create('order')!;
        const result = sm.send(inst.id, 'submit');
        expect(result.success).toBe(true);
        expect(sm.getState(inst.id)).toBe('submitted');
    });

    it('should reject invalid transitions', () => {
        const inst = sm.create('order')!;
        const result = sm.send(inst.id, 'approve');
        expect(result.success).toBe(false);
    });

    it('should track history', () => {
        const inst = sm.create('order')!;
        sm.send(inst.id, 'submit');
        sm.send(inst.id, 'approve');
        expect(sm.getInstance(inst.id)?.history).toHaveLength(2);
    });

    it('should get available events', () => {
        const inst = sm.create('order')!;
        expect(sm.getAvailableEvents(inst.id)).toContain('submit');
    });

    it('should support guards', () => {
        sm.define({ id: 'guarded', initialState: 'a', states: ['a', 'b'], transitions: [
            { from: 'a', to: 'b', event: 'go', guard: (ctx) => ctx.allowed === true },
        ] });
        const inst = sm.create('guarded', { allowed: false })!;
        expect(sm.send(inst.id, 'go').success).toBe(false);
    });
});

// ================================================================
describe('CircuitBreaker', () => {
    let cb: CircuitBreaker;
    beforeEach(() => { cb = new CircuitBreaker(); });

    it('should execute successfully', async () => {
        const result = await cb.execute('api', async () => 'ok');
        expect(result).toBe('ok');
    });

    it('should track failures', async () => {
        for (let i = 0; i < 3; i++) {
            try { await cb.execute('api', async () => { throw new Error('fail'); }, { failureThreshold: 10 }); } catch {}
        }
        expect(cb.getStats('api')?.failures).toBe(3);
    });

    it('should open after threshold', async () => {
        for (let i = 0; i < 5; i++) {
            try { await cb.execute('api', async () => { throw new Error('fail'); }); } catch {}
        }
        expect(cb.getState('api')).toBe('open');
    });

    it('should reject when open', async () => {
        for (let i = 0; i < 5; i++) {
            try { await cb.execute('api', async () => { throw new Error('fail'); }); } catch {}
        }
        await expect(cb.execute('api', async () => 'ok')).rejects.toThrow('Circuit "api" is open');
    });

    it('should reset', async () => {
        for (let i = 0; i < 5; i++) {
            try { await cb.execute('api', async () => { throw new Error('fail'); }); } catch {}
        }
        cb.reset('api');
        expect(cb.getState('api')).toBe('closed');
    });

    it('should list circuits', async () => {
        await cb.execute('svc-a', async () => 'ok');
        expect(cb.list()).toHaveLength(1);
    });
});
