/**
 * agents/bootstrap-cache.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BootstrapCache } from './bootstrap-cache.js';

describe('Bootstrap Cache', () => {
    it('get/set basic', () => {
        const cache = new BootstrapCache<string>();
        cache.set('a', 'hello');
        expect(cache.get('a')).toBe('hello');
    });

    it('returns undefined for missing', () => {
        const cache = new BootstrapCache();
        expect(cache.get('missing')).toBeUndefined();
    });

    it('has', () => {
        const cache = new BootstrapCache();
        cache.set('a', 1);
        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
    });

    it('delete', () => {
        const cache = new BootstrapCache();
        cache.set('a', 1);
        expect(cache.delete('a')).toBe(true);
        expect(cache.has('a')).toBe(false);
    });

    it('clear', () => {
        const cache = new BootstrapCache();
        cache.set('a', 1); cache.set('b', 2);
        cache.clear();
        expect(cache.size()).toBe(0);
    });

    it('evicts oldest at max size', () => {
        const cache = new BootstrapCache(2);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3); // should evict 'a'
        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
    });

    it('TTL expiration', () => {
        vi.useFakeTimers();
        const cache = new BootstrapCache(100, 1000);
        cache.set('a', 'value');
        expect(cache.get('a')).toBe('value');
        vi.advanceTimersByTime(1500);
        expect(cache.get('a')).toBeUndefined();
        vi.useRealTimers();
    });

    it('prune removes expired', () => {
        vi.useFakeTimers();
        const cache = new BootstrapCache(100, 500);
        cache.set('a', 1); cache.set('b', 2);
        vi.advanceTimersByTime(600);
        const pruned = cache.prune();
        expect(pruned).toBe(2);
        expect(cache.size()).toBe(0);
        vi.useRealTimers();
    });

    it('keys and values', () => {
        const cache = new BootstrapCache<number>();
        cache.set('a', 1); cache.set('b', 2);
        expect(cache.keys().sort()).toEqual(['a', 'b']);
        expect(cache.values().sort()).toEqual([1, 2]);
    });

    it('stats tracks hits', () => {
        const cache = new BootstrapCache<string>();
        cache.set('a', 'v');
        cache.get('a'); cache.get('a');
        const stats = cache.stats();
        expect(stats.totalHits).toBe(2);
        expect(stats.size).toBe(1);
    });

    it('per-key TTL overrides default', () => {
        vi.useFakeTimers();
        const cache = new BootstrapCache(100, 10_000);
        cache.set('short', 'val', 100);
        vi.advanceTimersByTime(200);
        expect(cache.get('short')).toBeUndefined();
        vi.useRealTimers();
    });
});
