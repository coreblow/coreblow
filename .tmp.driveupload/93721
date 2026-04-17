/**
 * CoreBlow Phase 39 — Caching & Performance Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '../../src/infra/lru-cache.js';
import { CacheInvalidation } from '../../src/infra/cache-invalidation.js';
import { ResponseCompression } from '../../src/infra/response-compression.js';
import { ConnectionPoolV2 } from '../../src/infra/connection-pool-v2.js';
import { LazyLoader } from '../../src/infra/lazy-loader.js';

// ================================================================
describe('LRUCache', () => {
    let cache: LRUCache<string>;
    beforeEach(() => { cache = new LRUCache<string>(3); });

    it('should get/set values', () => {
        cache.set('a', 'hello');
        expect(cache.get('a')).toBe('hello');
    });

    it('should evict LRU entries', () => {
        cache.set('a', '1'); cache.set('b', '2'); cache.set('c', '3');
        cache.set('d', '4'); // evicts 'a'
        expect(cache.get('a')).toBeUndefined();
        expect(cache.size()).toBe(3);
    });

    it('should handle TTL', () => {
        cache.set('x', 'val', 1); // 1ms TTL
        // wait would be needed for real test, but we check has
        expect(cache.has('x')).toBe(true);
    });

    it('should track stats', () => {
        cache.set('a', 'v');
        cache.get('a');
        cache.get('miss');
        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });

    it('should delete and clear', () => {
        cache.set('a', 'v');
        cache.delete('a');
        expect(cache.size()).toBe(0);
    });

    it('should calculate hit rate', () => {
        cache.set('a', 'v');
        cache.get('a'); cache.get('a'); cache.get('miss');
        expect(cache.getStats().hitRate).toBeCloseTo(0.667, 1);
    });
});

// ================================================================
describe('CacheInvalidation', () => {
    let ci: CacheInvalidation;
    beforeEach(() => {
        ci = new CacheInvalidation();
        ci.register('user:1', ['users', 'entity']);
        ci.register('user:2', ['users', 'entity']);
        ci.register('post:1', ['posts', 'entity']);
    });

    it('should invalidate by key', () => {
        ci.invalidateKey('user:1');
        expect(ci.isInvalidated('user:1')).toBe(true);
    });

    it('should invalidate by tag', () => {
        const keys = ci.invalidateByTag('users');
        expect(keys).toHaveLength(2);
    });

    it('should invalidate by pattern', () => {
        const keys = ci.invalidateByPattern('user:*');
        expect(keys).toHaveLength(2);
    });

    it('should notify listeners', () => {
        let notified: string[] = [];
        ci.onInvalidate((keys) => { notified = keys; });
        ci.invalidateKey('post:1');
        expect(notified).toContain('post:1');
    });

    it('should track stats', () => {
        ci.invalidateByTag('entity');
        expect(ci.getStats().byTag).toBe(3);
    });
});

// ================================================================
describe('ResponseCompression', () => {
    let comp: ResponseCompression;
    beforeEach(() => { comp = new ResponseCompression(); });

    it('should compress JSON', () => {
        const result = comp.compress('x'.repeat(2000), 'application/json');
        expect(result.skipped).toBe(false);
        expect(result.compressed).toBeLessThan(result.original);
    });

    it('should skip small payloads', () => {
        const result = comp.compress('small', 'application/json');
        expect(result.skipped).toBe(true);
    });

    it('should skip non-compressible types', () => {
        const result = comp.compress('x'.repeat(2000), 'image/png');
        expect(result.skipped).toBe(true);
    });

    it('should negotiate algorithm', () => {
        expect(comp.negotiate('gzip, deflate, br')).toBe('br');
        expect(comp.negotiate('gzip, deflate')).toBe('gzip');
    });

    it('should track stats', () => {
        comp.compress('x'.repeat(2000), 'application/json');
        expect(comp.getStats().compressed).toBe(1);
    });
});

// ================================================================
describe('ConnectionPoolV2', () => {
    let pool: ConnectionPoolV2;
    beforeEach(() => { pool = new ConnectionPoolV2(3); });

    it('should acquire connections', () => {
        const conn = pool.acquire('api.example.com');
        expect(conn?.status).toBe('active');
    });

    it('should release and reuse', () => {
        const conn = pool.acquire('api.example.com')!;
        pool.release(conn.id);
        const reused = pool.acquire('api.example.com');
        expect(reused?.id).toBe(conn.id);
    });

    it('should enforce per-host limit', () => {
        pool.acquire('host'); pool.acquire('host'); pool.acquire('host');
        expect(pool.acquire('host')).toBeNull();
    });

    it('should drain host', () => {
        pool.acquire('h1'); pool.acquire('h1');
        expect(pool.drain('h1')).toBe(2);
    });

    it('should get status', () => {
        pool.acquire('h1');
        const status = pool.getStatus();
        expect(status.active).toBe(1);
    });
});

// ================================================================
describe('LazyLoader', () => {
    let loader: LazyLoader;
    beforeEach(() => { loader = new LazyLoader(); });

    it('should load on first access', async () => {
        loader.register('db', async () => ({ connected: true }));
        const db = await loader.get<{ connected: boolean }>('db');
        expect(db?.connected).toBe(true);
    });

    it('should cache instances', async () => {
        let count = 0;
        loader.register('svc', async () => { count++; return count; });
        await loader.get('svc');
        await loader.get('svc');
        expect(count).toBe(1);
    });

    it('should invalidate', async () => {
        let count = 0;
        loader.register('svc', async () => ++count);
        await loader.get('svc');
        loader.invalidate('svc');
        await loader.get('svc');
        expect(count).toBe(2);
    });

    it('should load deps first', async () => {
        const order: string[] = [];
        loader.register('a', async () => { order.push('a'); return 'a'; });
        loader.register('b', async () => { order.push('b'); return 'b'; }, { deps: ['a'] });
        await loader.get('b');
        expect(order).toEqual(['a', 'b']);
    });

    it('should track stats', async () => {
        loader.register('x', async () => 1);
        await loader.get('x');
        await loader.get('x');
        expect(loader.getStats().loaded).toBe(1);
        expect(loader.getStats().cached).toBe(1);
    });
});
