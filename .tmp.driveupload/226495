import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateMachine } from '../../src/infra/state-machine.js';
import { FeatureFlags } from '../../src/infra/feature-flags.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';

describe('Wave 54: State Machine & Feature Flags', () => {

    describe('StateMachine (state-machine.ts)', () => {
        let sm: StateMachine;

        beforeEach(() => {
            sm = new StateMachine();

            sm.define({
                id: 'auth',
                initialState: 'logged_out',
                states: ['logged_out', 'authenticating', 'logged_in', 'error'],
                transitions: [
                    { from: 'logged_out', to: 'authenticating', event: 'login' },
                    { from: 'authenticating', to: 'logged_in', event: 'success', action: (ctx) => { ctx.token = 'abc'; } },
                    { from: 'authenticating', to: 'error', event: 'fail' },
                    { from: 'logged_in', to: 'logged_out', event: 'logout' },
                    { from: 'error', to: 'logged_out', event: 'retry', guard: (ctx) => ctx.retryCount < 3 }
                ]
            });
        });

        it('creates an instance with initial state', () => {
            const instance = sm.create('auth');
            expect(instance).toBeDefined();
            expect(instance?.currentState).toBe('logged_out');
            expect(instance?.context).toEqual({});
        });

        it('transitions successfully and runs actions', () => {
            const instance = sm.create('auth', { retryCount: 0 })!;

            let res = sm.send(instance.id, 'login');
            expect(res.success).toBe(true);
            expect(res.newState).toBe('authenticating');

            res = sm.send(instance.id, 'success');
            expect(res.success).toBe(true);
            expect(res.newState).toBe('logged_in');

            // Check if action was run
            const latest = sm.getInstance(instance.id);
            expect(latest?.context.token).toBe('abc');
        });

        it('fails to transition on invalid event', () => {
            const instance = sm.create('auth')!;

            // cannot logout from logged_out
            const res = sm.send(instance.id, 'logout');
            expect(res.success).toBe(false);
            expect(res.error).toContain('No transition');

            expect(sm.getState(instance.id)).toBe('logged_out');
        });

        it('respects guard conditions', () => {
            const instanceId1 = sm.create('auth', { retryCount: 5 })!.id;
            sm.send(instanceId1, 'login');
            sm.send(instanceId1, 'fail'); // now in error

            expect(sm.getState(instanceId1)).toBe('error');

            // guard retryCount < 3 fails
            const resGuardFailed = sm.send(instanceId1, 'retry');
            expect(resGuardFailed.success).toBe(false);
            expect(resGuardFailed.error).toContain('Guard condition');
            expect(sm.getState(instanceId1)).toBe('error');

            const instanceId2 = sm.create('auth', { retryCount: 1 })!.id;
            sm.send(instanceId2, 'login');
            sm.send(instanceId2, 'fail');

            const resGuardOk = sm.send(instanceId2, 'retry');
            expect(resGuardOk.success).toBe(true);
            expect(sm.getState(instanceId2)).toBe('logged_out');
        });

        it('returns available events', () => {
             const instance = sm.create('auth')!;
             expect(sm.getAvailableEvents(instance.id)).toEqual(['login']);

             sm.send(instance.id, 'login');
             expect(sm.getAvailableEvents(instance.id)).toEqual(['success', 'fail']);
        });

        it('records transition history', () => {
             const instance = sm.create('auth')!;
             sm.send(instance.id, 'login');
             sm.send(instance.id, 'success');

             const inst = sm.getInstance(instance.id)!;
             expect(inst.history).toHaveLength(2);
             expect(inst.history[0]?.event).toBe('login');
             expect(inst.history[1]?.event).toBe('success');
        });
    });

    describe('FeatureFlags (feature-flags.ts)', () => {
        let ff: FeatureFlags;

        beforeEach(() => {
            ff = new FeatureFlags();
            ff.define('beta', 'Beta Feature', false);
            ff.define('targeted', 'Targeted Feature', true, { targetUsers: ['user1'] });
            ff.define('rollout', 'Rollout 25%', true, { rolloutPercent: 25 });
        });

        it('can toggle and set state', () => {
            expect(ff.isEnabled('beta')).toBe(false);

            ff.toggle('beta');
            expect(ff.isEnabled('beta')).toBe(true);

            ff.setEnabled('beta', false);
            expect(ff.isEnabled('beta')).toBe(false);
        });

        it('evaluates targeted users correctly', () => {
             expect(ff.isEnabled('targeted')).toBe(false); // No context
             expect(ff.isEnabled('targeted', { userId: 'user2' })).toBe(false);
             expect(ff.isEnabled('targeted', { userId: 'user1' })).toBe(true);
        });

        it('evaluates rollout percentages deterministically', () => {
             // 25% rollout
             // We can test a few user IDs
             let countEnabled = 0;
             for (let i = 0; i < 100; i++) {
                  if (ff.isEnabled('rollout', { userId: `u${i}` })) {
                       countEnabled++;
                  }
             }
             // deterministic hash means some stable percentage should be around 25
             expect(countEnabled).toBeGreaterThan(15);
             expect(countEnabled).toBeLessThan(35);

             // Without user context, applies "true" if rollout > 50, otherwise false
             expect(ff.isEnabled('rollout')).toBe(false);

             ff.setRollout('rollout', 51);
             expect(ff.isEnabled('rollout')).toBe(true);
        });

        it('lists and deletes flags', () => {
             expect(ff.list()).toHaveLength(3);

             ff.delete('beta');
             expect(ff.list()).toHaveLength(2);
             expect(ff.count()).toBe(2);
        });
    });

    describe('DeadLetterQueue (dead-letter-queue.ts)', () => {
        let dlq: DeadLetterQueue;

        beforeEach(() => {
            dlq = new DeadLetterQueue();
            vi.useFakeTimers();
            vi.setSystemTime(1000);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('adds dead letters', () => {
             const dl = dlq.add('email-queue', { to: 'x' }, 'timeout', 3);
             expect(dl.id).toBeDefined();
             expect(dl.originalQueue).toBe('email-queue');
             expect(dlq.count()).toBe(1);
        });

        it('retrieves unretried and by queue', () => {
             const dl1 = dlq.add('q1', null, 'err', 1);
             const dl2 = dlq.add('q1', null, 'err', 1);
             const dl3 = dlq.add('q2', null, 'err', 1);

             dlq.markRetried(dl1.id);

             expect(dlq.getByQueue('q1')).toHaveLength(2);
             expect(dlq.getUnretried()).toHaveLength(2); // dl2 and dl3

             const sum = dlq.summary();
             expect(sum).toEqual([
                  { queue: 'q1', count: 2, unretried: 1 },
                  { queue: 'q2', count: 1, unretried: 1 }
             ]);
        });

        it('purges old letters', async () => {
             dlq.add('q', null, 'err', 1); // time 1000

             await vi.advanceTimersByTimeAsync(10000); // time 11000
             dlq.add('q', null, 'err', 1); // time 11000

             expect(dlq.count()).toBe(2);

             // purge older than 5000 ms (cutoff is 11000 - 5000 = 6000)
             // Should purge the first one
             const purgedCount = dlq.purge(5000);

             expect(purgedCount).toBe(1);
             expect(dlq.count()).toBe(1);
        });
    });

});
