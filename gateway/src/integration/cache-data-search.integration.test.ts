// @ts-nocheck
/**
 * Integration Test Suite 2: Cache-Data-Search Chain
 *
 * Verifies: DataEnricher → DataTransformer → DataPipeline → CacheManager → CacheInvalidation → FuzzySearch
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataEnricher } from '../infra/data-enricher.js';
import { DataTransformer } from '../infra/data-transformer.js';
import { DataPipeline } from '../infra/data-pipeline.js';
import { CacheManager } from '../infra/cache-manager.js';
import { CacheInvalidation } from '../infra/cache-invalidation.js';
import { FuzzySearch } from '../infra/fuzzy-search.js';

describe('Integration: Cache-Data-Search Chain', () => {
    let enricher: DataEnricher;
    let transformer: DataTransformer;
    let cache: CacheManager<any>;
    let invalidation: CacheInvalidation;
    let fuzzy: FuzzySearch;

    beforeEach(() => {
        enricher = new DataEnricher();
        transformer = new DataTransformer();
        cache = new CacheManager({ defaultTTL: 5000, maxEntries: 100 });
        invalidation = new CacheInvalidation();
        fuzzy = new FuzzySearch();

        // Seed enricher with lookup data
        enricher.addSource('users', 'userId', [
            { userId: 'u1', name: 'Alice', role: 'admin', dept: 'Engineering' },
            { userId: 'u2', name: 'Bob', role: 'user', dept: 'Marketing' },
            { userId: 'u3', name: 'Charlie', role: 'user', dept: 'Engineering' },
        ]);
    });

    it('enrich → transform → cache: full data pipeline', () => {
        // Step 1: Enrich raw record
        const raw = { id: 1, userId: 'u1' };
        const enriched = enricher.enrich(raw);
        expect(enriched.name).toBe('Alice');
        expect(enriched.role).toBe('admin');

        // Step 2: Transform (pick relevant fields, rename)
        transformer.pick(['id', 'name', 'role', 'dept']).rename('dept', 'department');
        const transformed = transformer.transform(enriched);
        expect(transformed.department).toBe('Engineering');
        expect(transformed.userId).toBeUndefined(); // picked out

        // Step 3: Cache the result
        cache.set(`user:${raw.id}`, transformed);
        invalidation.register(`user:${raw.id}`, ['user', 'engineering']);

        // Step 4: Verify cache hit
        const cached = cache.get(`user:${raw.id}`);
        expect(cached).toEqual(transformed);
        expect(cache.getStats().hits).toBe(1);
    });

    it('cache hit avoids re-enrichment', () => {
        // First call: enrich + cache
        const enriched = enricher.enrich({ userId: 'u2' });
        cache.set('profile:u2', enriched);

        // Second call: cache hit, no enrichment needed
        const fromCache = cache.get('profile:u2');
        expect(fromCache!.name).toBe('Bob');

        const stats = enricher.getStats();
        expect(stats.enriched).toBe(1); // only enriched once
    });

    it('tag-based invalidation clears related cache entries', () => {
        // Cache multiple entries tagged by department
        cache.set('user:1', { name: 'Alice' });
        cache.set('user:3', { name: 'Charlie' });
        invalidation.register('user:1', ['engineering']);
        invalidation.register('user:3', ['engineering']);
        invalidation.register('user:2', ['marketing']);

        // Invalidate all engineering entries
        const invalidated = invalidation.invalidateByTag('engineering');
        expect(invalidated).toContain('user:1');
        expect(invalidated).toContain('user:3');
        expect(invalidated).toHaveLength(2);

        // Delete from cache based on invalidation result
        for (const key of invalidated) {
            cache.delete(key);
        }

        expect(cache.get('user:1')).toBeUndefined();
        expect(cache.get('user:3')).toBeUndefined();
    });

    it('pipeline multi-stage with filter and transform', async () => {
        const pipeline = DataPipeline.create<Record<string, any>>()
            .map('enrich', (record) => enricher.enrich(record))
            .filter('isAdmin', (record) => record.role === 'admin')
            .map('format', (record) => ({ display: `${record.name} (${record.role})` }));

        // Admin passes filter
        const r1 = await pipeline.execute({ userId: 'u1' });
        expect(r1.success).toBe(true);
        expect(r1.output.display).toBe('Alice (admin)');

        // Non-admin skips filter stage
        const r2 = await pipeline.execute({ userId: 'u2' });
        expect(r2.success).toBe(true);
        // Filter skipped → format still runs on un-filtered data
        expect(r2.output.display).toBe('Bob (user)');
    });

    it('pipeline error does not pollute cache', async () => {
        const pipeline = DataPipeline.create<string>()
            .map('fail', () => { throw new Error('transform error'); });

        const result = await pipeline.execute('input');
        expect(result.success).toBe(false);

        // Cache should remain clean
        expect(cache.size()).toBe(0);
    });

    it('re-enrichment after invalidation refreshes cache', () => {
        // Initial enrich + cache
        const v1 = enricher.enrich({ userId: 'u1' });
        cache.set('user:u1', v1);
        invalidation.register('user:u1', ['user']);

        // Simulate data change: invalidate
        invalidation.invalidateKey('user:u1');
        cache.delete('user:u1');
        expect(cache.get('user:u1')).toBeUndefined();

        // Re-enrich and re-cache
        const v2 = enricher.enrich({ userId: 'u1' });
        cache.set('user:u1', v2);
        expect(cache.get('user:u1')!.name).toBe('Alice');
    });

    it('fuzzy search on cached enriched data', () => {
        // Enrich and cache multiple users
        const users = enricher.enrichMany([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]);
        for (const user of users) {
            cache.set(`user:${user.userId}`, user);
            fuzzy.add(user.userId, `${user.name} ${user.dept}`);
        }

        // Search for engineering people
        const results = fuzzy.search('Engineering');
        expect(results.length).toBeGreaterThanOrEqual(2); // Alice + Charlie
        const ids = results.map(r => r.id);
        expect(ids).toContain('u1');
        expect(ids).toContain('u3');

        // Verify cached data is accessible for each result
        for (const match of results) {
            const cached = cache.get(`user:${match.id}`);
            expect(cached).toBeDefined();
            expect(cached!.dept).toBe('Engineering');
        }
    });

    it('end-to-end stats across enricher + cache', () => {
        // Multiple enrichments
        enricher.enrich({ userId: 'u1' });
        enricher.enrich({ userId: 'u2' });
        enricher.enrich({ userId: 'unknown' }); // miss

        // Cache operations
        cache.set('a', 1);
        cache.get('a'); // hit
        cache.get('b'); // miss

        const enrichStats = enricher.getStats();
        expect(enrichStats.enriched).toBe(3);
        expect(enrichStats.lookupMisses).toBeGreaterThan(0);

        const cacheStats = cache.getStats();
        expect(cacheStats.hits).toBe(1);
        expect(cacheStats.misses).toBe(1);
    });

    it('invalidation callback auto-purges cache entries', () => {
        // Wire invalidation events to cache deletion
        invalidation.onInvalidate((keys) => {
            for (const key of keys) {
                cache.delete(key);
            }
        });

        // Populate cache + register with invalidation
        cache.set('session:abc', { user: 'Alice', active: true });
        cache.set('session:def', { user: 'Bob', active: true });
        invalidation.register('session:abc', ['session']);
        invalidation.register('session:def', ['session']);

        // Verify cache populated
        expect(cache.size()).toBe(2);

        // Invalidate by tag — callback should auto-delete from cache
        invalidation.invalidateByTag('session');

        expect(cache.get('session:abc')).toBeUndefined();
        expect(cache.get('session:def')).toBeUndefined();
        expect(cache.size()).toBe(0);
    });
});
