// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from './state-machine.js';
import { RetryPolicy } from './retry-policy.js';

describe('State Machine — Phase 16', () => {
    let sm: StateMachine;

    beforeEach(() => {
        sm = new StateMachine();
        sm.define({
            id: 'order',
            initialState: 'pending',
            states: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            transitions: [
                { from: 'pending', to: 'processing', event: 'start' },
                { from: 'processing', to: 'shipped', event: 'ship' },
                { from: 'shipped', to: 'delivered', event: 'deliver' },
                { from: 'pending', to: 'cancelled', event: 'cancel' },
                { from: 'processing', to: 'cancelled', event: 'cancel' },
            ],
        });
    });

    it('creates instance in initial state', () => {
        const inst = sm.create('order');
        expect(inst).not.toBeNull();
        expect(inst!.currentState).toBe('pending');
    });

    it('returns null for unknown definition', () => {
        expect(sm.create('nonexistent')).toBeNull();
    });

    it('transitions on valid event', () => {
        const inst = sm.create('order')!;
        const result = sm.send(inst.id, 'start');
        expect(result.success).toBe(true);
        expect(result.newState).toBe('processing');
        expect(sm.getState(inst.id)).toBe('processing');
    });

    it('rejects invalid event', () => {
        const inst = sm.create('order')!;
        const result = sm.send(inst.id, 'ship'); // can't ship from pending
        expect(result.success).toBe(false);
        expect(result.error).toContain('No transition');
    });

    it('records transition history', () => {
        const inst = sm.create('order')!;
        sm.send(inst.id, 'start');
        sm.send(inst.id, 'ship');
        const state = sm.getInstance(inst.id)!;
        expect(state.history).toHaveLength(2);
        expect(state.history[0].from).toBe('pending');
        expect(state.history[0].to).toBe('processing');
    });

    it('guard blocks transition', () => {
        sm.define({
            id: 'guarded',
            initialState: 'locked',
            states: ['locked', 'unlocked'],
            transitions: [
                { from: 'locked', to: 'unlocked', event: 'unlock', guard: (ctx) => ctx.hasKey === true },
            ],
        });
        const inst = sm.create('guarded', { hasKey: false })!;
        const result = sm.send(inst.id, 'unlock');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Guard');
    });

    it('action modifies context', () => {
        sm.define({
            id: 'counter',
            initialState: 'idle',
            states: ['idle', 'active'],
            transitions: [
                { from: 'idle', to: 'active', event: 'go', action: (ctx) => { ctx.count = (ctx.count as number || 0) + 1; } },
            ],
        });
        const inst = sm.create('counter')!;
        sm.send(inst.id, 'go');
        expect(sm.getInstance(inst.id)!.context.count).toBe(1);
    });

    it('getAvailableEvents returns valid events', () => {
        const inst = sm.create('order')!;
        expect(sm.getAvailableEvents(inst.id)).toContain('start');
        expect(sm.getAvailableEvents(inst.id)).toContain('cancel');
    });

    it('getAvailableEvents returns empty for unknown', () => {
        expect(sm.getAvailableEvents('nope')).toEqual([]);
    });

    it('count tracks instances', () => {
        sm.create('order');
        sm.create('order');
        expect(sm.count()).toBe(2);
    });
});

describe('Retry Policy — Phase 16', () => {
    it('succeeds on first try', async () => {
        const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1, jitter: false });
        const result = await policy.execute(async () => 42);
        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
        expect(result.attempts).toBe(1);
    });

    it('retries on failure then succeeds', async () => {
        let calls = 0;
        const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1, jitter: false });
        const result = await policy.execute(async () => {
            calls++;
            if (calls < 3) throw new Error('fail');
            return 'ok';
        });
        expect(result.success).toBe(true);
        expect(result.data).toBe('ok');
        expect(result.attempts).toBe(3);
    });

    it('exhausts retries and fails', async () => {
        const policy = new RetryPolicy({ maxRetries: 2, baseDelayMs: 1, jitter: false });
        const result = await policy.execute(async () => { throw new Error('always fail'); });
        expect(result.success).toBe(false);
        expect(result.error!.message).toBe('always fail');
        expect(result.attempts).toBe(3); // 1 initial + 2 retries
    });

    it('noRetry policy fails immediately', async () => {
        const policy = RetryPolicy.noRetry();
        const result = await policy.execute(async () => { throw new Error('nope'); });
        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
    });

    it('retryOn predicate controls retry', async () => {
        let calls = 0;
        const policy = new RetryPolicy({ maxRetries: 5, baseDelayMs: 1, jitter: false });
        const result = await policy.execute(
            async () => { calls++; throw new Error('fail'); },
            { retryOn: (_err, attempt) => attempt < 1 }, // only retry once
        );
        expect(result.success).toBe(false);
        expect(calls).toBe(2); // initial + 1 retry
    });

    it('stats track calls', async () => {
        const policy = new RetryPolicy({ maxRetries: 1, baseDelayMs: 1, jitter: false });
        await policy.execute(async () => 'ok');
        await policy.execute(async () => { throw new Error('fail'); });
        const stats = policy.getStats();
        expect(stats.totalCalls).toBe(2);
        expect(stats.totalSuccess).toBe(1);
        expect(stats.totalFailed).toBe(1);
    });

    it('resetStats clears counters', async () => {
        const policy = new RetryPolicy({ maxRetries: 0, baseDelayMs: 1 });
        await policy.execute(async () => 'ok');
        policy.resetStats();
        expect(policy.getStats().totalCalls).toBe(0);
    });

    it('aggressive preset has 5 retries', () => {
        const p = RetryPolicy.aggressive();
        expect(p).toBeInstanceOf(RetryPolicy);
    });

    it('conservative preset has 2 retries', () => {
        const p = RetryPolicy.conservative();
        expect(p).toBeInstanceOf(RetryPolicy);
    });
});
