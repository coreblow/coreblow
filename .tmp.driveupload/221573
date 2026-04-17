import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlags } from './feature-flags.js';
import { MessageBroker } from './message-broker.js';
import { CacheInvalidation } from './cache-invalidation.js';

describe('Infrastructure — Phase 7', () => {

    // ─── Feature Flags ─────────────────────────────────────────

    describe('FeatureFlags', () => {
        let flags: FeatureFlags;

        beforeEach(() => {
            flags = new FeatureFlags();
        });

        it('defines and checks flag', () => {
            flags.define('dark-mode', 'Dark Mode', true);
            expect(flags.isEnabled('dark-mode')).toBe(true);
            expect(flags.count()).toBe(1);
        });

        it('disabled flag returns false', () => {
            flags.define('beta', 'Beta Feature', false);
            expect(flags.isEnabled('beta')).toBe(false);
        });

        it('unknown flag returns false', () => {
            expect(flags.isEnabled('nonexistent')).toBe(false);
        });

        it('user targeting includes matching user', () => {
            flags.define('vip', 'VIP Feature', true, { targetUsers: ['alice', 'bob'] });
            expect(flags.isEnabled('vip', { userId: 'alice' })).toBe(true);
            expect(flags.isEnabled('vip', { userId: 'charlie' })).toBe(false);
            expect(flags.isEnabled('vip')).toBe(false); // no context
        });

        it('channel targeting', () => {
            flags.define('slack-only', 'Slack Only', true, { targetChannels: ['slack'] });
            expect(flags.isEnabled('slack-only', { channel: 'slack' })).toBe(true);
            expect(flags.isEnabled('slack-only', { channel: 'discord' })).toBe(false);
        });

        it('percentage rollout is deterministic per user', () => {
            flags.define('rollout', 'Gradual', true, { rolloutPercent: 50 });
            // Same userId should always get same result
            const r1 = flags.isEnabled('rollout', { userId: 'user-42' });
            const r2 = flags.isEnabled('rollout', { userId: 'user-42' });
            expect(r1).toBe(r2);
        });

        it('toggle flips state', () => {
            flags.define('f1', 'F1', true);
            flags.toggle('f1');
            expect(flags.isEnabled('f1')).toBe(false);
            flags.toggle('f1');
            expect(flags.isEnabled('f1')).toBe(true);
        });

        it('setRollout clamps value', () => {
            flags.define('r1', 'R1', true);
            flags.setRollout('r1', 150);
            expect(flags.get('r1')!.rolloutPercent).toBe(100);
            flags.setRollout('r1', -10);
            expect(flags.get('r1')!.rolloutPercent).toBe(0);
        });

        it('list returns all flags', () => {
            flags.define('a', 'A', true);
            flags.define('b', 'B', false);
            const list = flags.list();
            expect(list).toHaveLength(2);
            expect(list.map(f => f.id)).toEqual(['a', 'b']);
        });

        it('delete removes flag', () => {
            flags.define('temp', 'Temp', true);
            expect(flags.delete('temp')).toBe(true);
            expect(flags.count()).toBe(0);
        });
    });

    // ─── Message Broker ────────────────────────────────────────

    describe('MessageBroker', () => {
        let broker: MessageBroker;

        beforeEach(() => {
            broker = new MessageBroker();
        });

        it('publishes message to queue', () => {
            const msg = broker.publish('emails', { to: 'alice@test.com' });
            expect(msg.id).toBeTruthy();
            expect(msg.status).toBe('pending');
            expect(broker.depth('emails')).toBe(1);
        });

        it('subscribes consumer', () => {
            const id = broker.subscribe('tasks', async () => true);
            expect(id).toContain('consumer');
        });

        it('processes message successfully', async () => {
            broker.publish('q', { data: 'test' });
            broker.subscribe('q', async () => true);
            const msg = await broker.processNext('q');
            expect(msg!.status).toBe('completed');
            expect(broker.depth('q')).toBe(0);
        });

        it('retries on failure', async () => {
            broker.publish('q', { data: 'fail' }, 0, 3);
            broker.subscribe('q', async () => false);
            const msg = await broker.processNext('q');
            expect(msg!.status).toBe('pending'); // retried
            expect(msg!.attempts).toBe(1);
        });

        it('marks failed after max attempts', async () => {
            broker.publish('q', { data: 'fail' }, 0, 1);
            broker.subscribe('q', async () => false);
            const msg = await broker.processNext('q');
            expect(msg!.status).toBe('failed');
        });

        it('processes by priority', () => {
            broker.publish('q', { data: 'low' }, 1);
            broker.publish('q', { data: 'high' }, 10);
            const queue = broker.listQueues();
            expect(queue[0]!.depth).toBe(2);
        });

        it('listQueues shows all queues', () => {
            broker.publish('q1', 'a');
            broker.publish('q2', 'b');
            broker.subscribe('q1', async () => true);
            const queues = broker.listQueues();
            expect(queues).toHaveLength(2);
            expect(queues.find(q => q.name === 'q1')!.consumers).toBe(1);
        });

        it('getStats tracks operations', async () => {
            broker.publish('q', 'data');
            broker.subscribe('q', async () => true);
            await broker.processNext('q');
            const stats = broker.getStats();
            expect(stats.published).toBe(1);
            expect(stats.consumed).toBe(1);
        });

        it('returns null when no messages', async () => {
            broker.subscribe('empty', async () => true);
            expect(await broker.processNext('empty')).toBeNull();
        });
    });

    // ─── Cache Invalidation ────────────────────────────────────

    describe('CacheInvalidation', () => {
        let cache: CacheInvalidation;

        beforeEach(() => {
            cache = new CacheInvalidation();
        });

        it('registers and checks invalidation', () => {
            cache.register('user:1', ['user', 'profile']);
            expect(cache.isInvalidated('user:1')).toBe(false);
            cache.invalidateKey('user:1');
            expect(cache.isInvalidated('user:1')).toBe(true);
        });

        it('invalidates by tag', () => {
            cache.register('user:1', ['user']);
            cache.register('user:2', ['user']);
            cache.register('post:1', ['post']);
            const invalidated = cache.invalidateByTag('user');
            expect(invalidated).toHaveLength(2);
            expect(cache.isInvalidated('user:1')).toBe(true);
            expect(cache.isInvalidated('post:1')).toBe(false);
        });

        it('invalidates by pattern', () => {
            cache.register('user:1', ['user']);
            cache.register('user:2', ['user']);
            cache.register('post:1', ['post']);
            const invalidated = cache.invalidateByPattern('user:*');
            expect(invalidated).toHaveLength(2);
        });

        it('fires listeners', () => {
            const invalidated: string[] = [];
            cache.onInvalidate((keys) => invalidated.push(...keys));
            cache.register('k1', ['tag']);
            cache.invalidateKey('k1');
            expect(invalidated).toEqual(['k1']);
        });

        it('tracks stats', () => {
            cache.register('a', ['t']);
            cache.register('b', ['t']);
            cache.invalidateByTag('t');
            const stats = cache.getStats();
            expect(stats.invalidated).toBe(2);
            expect(stats.byTag).toBe(2);
        });

        it('returns empty for unknown tag', () => {
            expect(cache.invalidateByTag('missing')).toEqual([]);
        });

        it('count tracks entries', () => {
            cache.register('a', ['x']);
            cache.register('b', ['y']);
            expect(cache.count()).toBe(2);
        });
    });
});
