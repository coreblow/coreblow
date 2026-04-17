import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager } from './cache-manager.js';
import { CacheInvalidation } from './cache-invalidation.js';
import { MessageBroker } from './message-broker.js';

// ─── Cache Manager ──────────────────────────────────────────────

describe('Cache Manager — Phase 22', () => {
    let cache: CacheManager<string>;

    beforeEach(() => {
        cache = new CacheManager({ defaultTTL: 1000, maxEntries: 3, eviction: 'lru' });
    });

    it('get and set cache entry', () => {
        cache.set('key1', 'val1');
        expect(cache.get('key1')).toBe('val1');
        expect(cache.has('key1')).toBe(true);
        expect(cache.size()).toBe(1);
    });

    it('returns undefined on miss', () => {
        expect(cache.get('unknown')).toBeUndefined();
    });

    it('evicts LRU when exceeding maxEntries', async () => {
        cache.set('k1', 'v1');
        await new Promise(r => setTimeout(r, 5));
        cache.set('k2', 'v2');
        await new Promise(r => setTimeout(r, 5));
        cache.set('k3', 'v3');
        cache.get('k1'); // promote k1 (updates lastAccessed)
        await new Promise(r => setTimeout(r, 5));
        cache.set('k4', 'v4'); // evicts k2

        expect(cache.get('k1')).toBe('v1');
        expect(cache.get('k2')).toBeUndefined();
        expect(cache.size()).toBe(3);
    });

    it('evicts FIFO when exceeding maxEntries', () => {
        const fifoCache = new CacheManager({ maxEntries: 2, eviction: 'fifo' });
        fifoCache.set('k1', 'v1');
        fifoCache.set('k2', 'v2');
        fifoCache.get('k1'); // access doesn't promote in FIFO context
        fifoCache.set('k3', 'v3'); // evicts first inserted (k1)

        expect(fifoCache.get('k1')).toBeUndefined();
        expect(fifoCache.get('k2')).toBe('v2');
    });

    it('expires keys based on TTL', async () => {
        cache.set('k1', 'v1', 10); // 10ms ttl
        await new Promise(r => setTimeout(r, 20));
        expect(cache.get('k1')).toBeUndefined();
        expect(cache.has('k1')).toBe(false);
    });

    it('getOrSet computes if missing', async () => {
        let calls = 0;
        const factory = async () => { calls++; return 'computed'; };

        const res1 = await cache.getOrSet('comp', factory);
        const res2 = await cache.getOrSet('comp', factory);

        expect(res1).toBe('computed');
        expect(res2).toBe('computed');
        expect(calls).toBe(1);
    });

    it('clears specific namespace', () => {
        cache.set('k1', 'v1', 0, 'ns1');
        cache.set('k2', 'v2', 0, 'ns2');

        const count = cache.clear('ns1');
        expect(count).toBe(1);
        expect(cache.has('k1')).toBe(false);
        expect(cache.has('k2')).toBe(true);
    });

    it('clears all if namespace empty', () => {
        cache.set('k1', 'v1');
        cache.set('k2', 'v2');
        cache.clear();
        expect(cache.size()).toBe(0);
    });

    it('tracks stats correctly', () => {
        cache.set('k1', 'v1');
        cache.get('k1'); // hit
        cache.get('k2'); // miss

        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.entries).toBe(1);
        expect(stats.hitRate).toBe(0.5);
    });

    it('delete returns true for existing key and false for missing', () => {
        cache.set('k1', 'v1');
        expect(cache.delete('k1')).toBe(true);
        expect(cache.delete('k1')).toBe(false);
        expect(cache.size()).toBe(0);
    });
});

// ─── Cache Invalidation ────────────────────────────────────────

describe('Cache Invalidation — Phase 22', () => {
    let inv: CacheInvalidation;

    beforeEach(() => {
        inv = new CacheInvalidation();
        inv.register('user:1', ['user', 'entity']);
        inv.register('post:10', ['post', 'entity']);
    });

    it('invalidates by exact key', () => {
        let notified: string[] = [];
        inv.onInvalidate((keys) => notified = keys);

        expect(inv.invalidateKey('user:1')).toBe(true);
        expect(inv.isInvalidated('user:1')).toBe(true);
        expect(inv.isInvalidated('post:10')).toBe(false);
        expect(notified).toEqual(['user:1']);
    });

    it('returns false for unknown key', () => {
        expect(inv.invalidateKey('unknown')).toBe(false);
    });

    it('invalidates by tag', () => {
        const invalidated = inv.invalidateByTag('entity');
        expect(invalidated).toContain('user:1');
        expect(invalidated).toContain('post:10');
        expect(inv.isInvalidated('user:1')).toBe(true);
        expect(inv.isInvalidated('post:10')).toBe(true);
    });

    it('returns empty for unknown tag', () => {
        expect(inv.invalidateByTag('xyz')).toHaveLength(0);
    });

    it('invalidates by pattern', () => {
        inv.register('user:2', ['user']);
        const invalidated = inv.invalidateByPattern('user:*');
        expect(invalidated).toContain('user:1');
        expect(invalidated).toContain('user:2');
        expect(inv.isInvalidated('post:10')).toBe(false);
    });

    it('preserves stats', () => {
        inv.invalidateKey('user:1');
        inv.invalidateByTag('post');
        inv.invalidateByPattern('us*');

        const stats = inv.getStats();
        expect(stats.invalidated).toBeGreaterThan(0);
        expect(stats.byTag).toBe(1);
        expect(inv.count()).toBe(2);
    });
});

// ─── Message Broker ────────────────────────────────────────────

describe('Message Broker — Phase 22', () => {
    let broker: MessageBroker;

    beforeEach(() => {
        broker = new MessageBroker();
    });

    it('publishes and queues message', () => {
        const msg = broker.publish('q1', { data: 'x' });
        expect(msg.id).toMatch(/^msg-/);
        expect(msg.status).toBe('pending');
        expect(broker.depth('q1')).toBe(1);
    });

    it('subscribes and returns id', () => {
        const id = broker.subscribe('q1', async () => true);
        expect(id).toMatch(/^consumer-/);
    });

    it('processNext completes message on success', async () => {
        broker.publish('q1', 'test');
        broker.subscribe('q1', async () => true);

        const msg = await broker.processNext('q1');
        expect(msg).not.toBeNull();
        expect(msg!.status).toBe('completed');
        expect(broker.depth('q1')).toBe(0);
    });

    it('processNext returns null if no messages', async () => {
        broker.subscribe('q1', async () => true);
        expect(await broker.processNext('q1')).toBeNull();
    });

    it('processNext returns null if no consumers', async () => {
        broker.publish('q1', 'test');
        expect(await broker.processNext('q1')).toBeNull();
    });

    it('retries on failure', async () => {
        broker.publish('q1', 'test', 0, 2); // max 2 retries
        broker.subscribe('q1', async () => false); // always fail

        const t1 = await broker.processNext('q1');
        expect(t1!.status).toBe('pending');
        expect(t1!.attempts).toBe(1);

        const t2 = await broker.processNext('q1');
        expect(t2!.status).toBe('failed');
        expect(t2!.attempts).toBe(2);
    });

    it('fails upon thrown error limit', async () => {
        broker.publish('q1', 'test', 0, 1); // max 1 attempt
        broker.subscribe('q1', async () => { throw new Error('boom'); });

        const msg = await broker.processNext('q1');
        expect(msg!.status).toBe('failed');
        expect(msg!.attempts).toBe(1);
    });

    it('prioritizes higher value messages', async () => {
        broker.publish('q1', 'low', 1);
        broker.publish('q1', 'high', 10);
        broker.publish('q1', 'mid', 5);
        broker.subscribe('q1', async () => true);

        const highest = await broker.processNext('q1');
        expect(highest!.payload).toBe('high');

        const second = await broker.processNext('q1');
        expect(second!.payload).toBe('mid');
    });

    it('tracks stats properly', async () => {
        broker.publish('q1', 'a');
        broker.publish('q1', 'b', 0, 1);
        broker.subscribe('q1', async (msg) => msg.payload === 'a');

        await broker.processNext('q1'); // success
        await broker.processNext('q1'); // failure

        const stats = broker.getStats();
        expect(stats.published).toBe(2);
        expect(stats.consumed).toBe(1);
        expect(stats.failed).toBe(1);
    });

    it('listQueues returns details', () => {
        broker.publish('q1', 'a');
        broker.publish('q2', 'b'); // populate q2
        broker.subscribe('q1', async () => true);
        broker.subscribe('q2', async () => true);

        const list = broker.listQueues();
        expect(list).toHaveLength(2);
        expect(list.find(q => q.name === 'q1')!.depth).toBe(1);
        expect(list.find(q => q.name === 'q1')!.consumers).toBe(1);
    });
});
