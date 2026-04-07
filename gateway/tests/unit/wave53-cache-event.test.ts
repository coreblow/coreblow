import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache } from '../../src/infra/lru-cache.js';
import { EventBus } from '../../src/infra/event-bus.js';
import { PubSub } from '../../src/infra/pub-sub.js';

describe('Wave 53: Caching & Eventing Infrastructure', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1000000000);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('LRUCache (lru-cache.ts)', () => {
        it('sets and gets values', () => {
            const cache = new LRUCache<string>(10);
            cache.set('a', 'apple');
            
            expect(cache.get('a')).toBe('apple');
            expect(cache.has('a')).toBe(true);
        });

        it('returns undefined for misses and tracks stats', () => {
            const cache = new LRUCache<string>(10);
            expect(cache.get('unknown')).toBeUndefined();
            
            const stats = cache.getStats();
            expect(stats.misses).toBe(1);
            expect(stats.hits).toBe(0);
        });

        it('evicts least recently used item when max size is reached', () => {
            // Map maintains insertion order, so the first inserted is the first deleted
            // unless it's accessed, then it is moved to the end.
            const cache = new LRUCache<number>(3);
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            
            // Access 'a' so 'b' becomes the oldest
            cache.get('a');
            
            // Add 'd', which should evict 'b' (size is 3)
            cache.set('d', 4);
            
            expect(cache.size()).toBe(3);
            expect(cache.has('a')).toBe(true);
            expect(cache.has('c')).toBe(true);
            expect(cache.has('d')).toBe(true);
            
            expect(cache.has('b')).toBe(false); // Evicted
            
            const stats = cache.getStats();
            expect(stats.evictions).toBe(1);
        });

        it('expires items based on TTL', async () => {
            const cache = new LRUCache<string>(10, 5000); // 5 sec default TTL
            cache.set('a', 'apple');
            cache.set('b', 'banana', 1000); // 1 sec explicit TTL
            
            expect(cache.has('a')).toBe(true);
            expect(cache.has('b')).toBe(true);
            
            // Advance by 2 seconds
            await vi.advanceTimersByTimeAsync(2000);
            
            expect(cache.has('a')).toBe(true);
            expect(cache.has('b')).toBe(false); // Expired
            
            // Advance by 4 more seconds
            await vi.advanceTimersByTimeAsync(4000);
            expect(cache.has('a')).toBe(false); // Expired
        });

        it('can clear cache manually', () => {
            const cache = new LRUCache<number>(10);
            cache.set('x', 1);
            expect(cache.size()).toBe(1);
            
            cache.clear();
            expect(cache.size()).toBe(0);
            expect(cache.get('x')).toBeUndefined();
        });
    });

    describe('EventBus (event-bus.ts)', () => {
        let bus: EventBus;

        beforeEach(() => {
            bus = new EventBus();
        });

        it('subscribes and receives events', async () => {
             const handler1 = vi.fn();
             const handler2 = vi.fn();
             
             bus.on('user.created', handler1);
             bus.on('user.created', handler2);
             
             const handledCount = await bus.emit('user.created', { id: 123 });
             
             expect(handledCount).toBe(2);
             expect(handler1).toHaveBeenCalledWith({ id: 123 });
             expect(handler2).toHaveBeenCalledWith({ id: 123 });
        });

        it('supports once() handlers', async () => {
             const handler = vi.fn();
             
             bus.once('ping', handler);
             
             await bus.emit('ping', 'a');
             await bus.emit('ping', 'b'); // Should not trigger handler
             
             expect(handler).toHaveBeenCalledTimes(1);
             expect(handler).toHaveBeenCalledWith('a');
        });

        it('can unsubscribe handlers', async () => {
             const handler = vi.fn();
             bus.on('test', handler);
             
             bus.off('test', handler);
             
             await bus.emit('test');
             expect(handler).not.toHaveBeenCalled();
        });

        it('tracks event history and stats', async () => {
             bus.on('app.start', () => {});
             await bus.emit('app.start', { version: '1' });
             await bus.emit('app.stop', null);
             
             const historyAll = bus.getHistory();
             expect(historyAll).toHaveLength(2);
             
             const historyStart = bus.getHistory('app.start');
             expect(historyStart).toHaveLength(1);
             expect(historyStart[0]?.data).toEqual({ version: '1' });
             
             const stats = bus.getStats();
             expect(stats.emitted).toBe(2);
             expect(stats.handled).toBe(1); // app.stop has no handlers
             
             const list = bus.listEvents();
             expect(list.find(l => l.event === 'app.start')?.handlers).toBe(1);
        });
    });

    describe('PubSub (pub-sub.ts)', () => {
        let ps: PubSub;

        beforeEach(() => {
            ps = new PubSub();
        });

        it('subscribes and publishes to topics', () => {
             const handler = vi.fn();
             const subId = ps.subscribe('system.metrics', handler);
             
             expect(subId).toBeDefined();
             
             ps.publish('system.metrics', { cpu: 50 });
             expect(handler).toHaveBeenCalledWith('system.metrics', { cpu: 50 });
        });

        it('supports wildcard topic subscriptions (*)', () => {
             const rootHandler = vi.fn();
             const nestedHandler = vi.fn();
             
             ps.subscribe('system.*', rootHandler);
             ps.subscribe('system.*.cpu', nestedHandler);
             
             ps.publish('system.metrics.memory', 10); // does not match system.*, does not match system.*.cpu
             ps.publish('system.node1', 20);          // matches system.*
             ps.publish('system.node1.cpu', 80);      // matches system.*.cpu
             
             // Depending on matching logic, system.* only matches two segments.
             expect(rootHandler).toHaveBeenCalledTimes(1);
             expect(nestedHandler).toHaveBeenCalledTimes(1);
             expect(nestedHandler).toHaveBeenCalledWith('system.node1.cpu', 80);
        });

        it('supports multi-level wildcard subscriptions (#)', () => {
             const handler = vi.fn();
             ps.subscribe('api.#', handler);
             
             ps.publish('api.v1.users.get', 'hello');
             ps.publish('api', 'world'); // Assuming api does not match api.# (must have at least one separator if it is literal api.#, though if # matches anything it might match depending on impl). Let's just check the multi-level one.
             ps.publish('auth.login', 'no');
             
             expect(handler).toHaveBeenCalledWith('api.v1.users.get', 'hello');
             expect(handler).not.toHaveBeenCalledWith('auth.login', 'no');
        });

        it('can unsubscribe via ID', () => {
             const handler = vi.fn();
             const subId = ps.subscribe('test', handler);
             
             ps.unsubscribe(subId);
             ps.publish('test', 'data');
             
             expect(handler).not.toHaveBeenCalled();
        });
    });

});
