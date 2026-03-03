/**
 * CoreBlow — LRU Cache
 *
 * Least Recently Used cache with TTL support,
 * max size eviction, and hit/miss statistics.
 */

/** Cache entry */
interface CacheEntry<T> {
    key: string;
    value: T;
    expiresAt?: number;
    accessedAt: number;
    createdAt: number;
}

/**
 * CoreBlow LRU Cache
 */
export class LRUCache<T = unknown> {
    private cache = new Map<string, CacheEntry<T>>();
    private maxSize: number;
    private defaultTTL?: number;
    private stats = { hits: 0, misses: 0, evictions: 0 };

    constructor(maxSize: number = 1000, defaultTTL?: number) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
    }

    /**
     * Get a value.
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) { this.stats.misses++; return undefined; }
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }
        // Move to end (most recent)
        this.cache.delete(key);
        entry.accessedAt = Date.now();
        this.cache.set(key, entry);
        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set a value.
     */
    set(key: string, value: T, ttlMs?: number): void {
        if (this.cache.has(key)) this.cache.delete(key);
        const ttl = ttlMs ?? this.defaultTTL;
        const entry: CacheEntry<T> = {
            key, value, accessedAt: Date.now(), createdAt: Date.now(),
            expiresAt: ttl ? Date.now() + ttl : undefined,
        };
        this.cache.set(key, entry);
        this.evictIfNeeded();
    }

    /**
     * Check if key exists (not expired).
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (entry.expiresAt && Date.now() > entry.expiresAt) { this.cache.delete(key); return false; }
        return true;
    }

    /**
     * Delete a key.
     */
    delete(key: string): boolean { return this.cache.delete(key); }

    /**
     * Clear all.
     */
    clear(): void { this.cache.clear(); }

    /**
     * Get stats.
     */
    getStats(): { hits: number; misses: number; evictions: number; size: number; hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        return { ...this.stats, size: this.cache.size, hitRate: total > 0 ? this.stats.hits / total : 0 };
    }

    /** Size */
    size(): number { return this.cache.size; }

    // === Private ===
    private evictIfNeeded(): void {
        while (this.cache.size > this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) { this.cache.delete(oldest); this.stats.evictions++; }
            else break;
        }
    }
}
