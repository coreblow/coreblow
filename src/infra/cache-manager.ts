/**
 * CoreBlow — Cache Manager
 *
 * Multi-layer caching with TTL, LRU eviction, namespaces,
 * statistics tracking, and batch operations.
 * Used for API responses, embeddings, and computed results.
 */

/** Cache entry */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    createdAt: number;
    accessCount: number;
    lastAccessed: number;
    namespace?: string;
}

/** Cache options */
export interface CacheOptions {
    /** Default TTL in ms (0 = no expiry) */
    defaultTTL?: number;
    /** Maximum entries */
    maxEntries?: number;
    /** Eviction policy */
    eviction?: 'lru' | 'fifo';
}

/**
 * CoreBlow Cache Manager
 */
export class CacheManager<T = unknown> {
    private store = new Map<string, CacheEntry<T>>();
    private options: Required<CacheOptions>;
    private hits = 0;
    private misses = 0;

    constructor(opts?: CacheOptions) {
        this.options = {
            defaultTTL: opts?.defaultTTL ?? 300_000, // 5 min
            maxEntries: opts?.maxEntries ?? 1000,
            eviction: opts?.eviction ?? 'lru',
        };
    }

    /**
     * Get a cached value.
     */
    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) { this.misses++; return undefined; }

        // Check expiry
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            this.store.delete(key);
            this.misses++;
            return undefined;
        }

        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.hits++;
        return entry.value;
    }

    /**
     * Set a cached value.
     */
    set(key: string, value: T, ttlMs?: number, namespace?: string): void {
        const ttl = ttlMs ?? this.options.defaultTTL;
        this.store.set(key, {
            value,
            expiresAt: ttl > 0 ? Date.now() + ttl : 0,
            createdAt: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now(),
            namespace,
        });
        this.evict();
    }

    /**
     * Check if key exists and not expired.
     */
    has(key: string): boolean {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete a key.
     */
    delete(key: string): boolean {
        return this.store.delete(key);
    }

    /**
     * Get or compute a value.
     */
    async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
        const cached = this.get(key);
        if (cached !== undefined) return cached;
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }

    /**
     * Clear all entries (optionally by namespace).
     */
    clear(namespace?: string): number {
        if (!namespace) {
            const count = this.store.size;
            this.store.clear();
            return count;
        }
        let count = 0;
        for (const [key, entry] of Array.from(this.store)) {
            if (entry.namespace === namespace) {
                this.store.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Get cache statistics.
     */
    getStats(): { entries: number; hits: number; misses: number; hitRate: number } {
        const total = this.hits + this.misses;
        return {
            entries: this.store.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
        };
    }

    /** Total entries */
    size(): number { return this.store.size; }

    // === Private ===

    private evict(): void {
        while (this.store.size > this.options.maxEntries) {
            if (this.options.eviction === 'lru') {
                let oldest: string | null = null;
                let oldestTime = Infinity;
                for (const [key, entry] of Array.from(this.store)) {
                    if (entry.lastAccessed < oldestTime) {
                        oldestTime = entry.lastAccessed;
                        oldest = key;
                    }
                }
                if (oldest) this.store.delete(oldest);
            } else {
                // FIFO — remove the first entry
                const first = Array.from(this.store.keys())[0];
                if (first) this.store.delete(first);
            }
        }
    }
}
