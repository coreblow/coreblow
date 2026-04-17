/**
 * agents/bootstrap-cache.ts
 * Cache management for bootstrap/session data.
 * Ported from OpenClaw src/agents/bootstrap-cache.ts.
 */

export interface CacheEntry<T = unknown> {
    key: string;
    value: T;
    createdAt: number;
    expiresAt?: number;
    hitCount: number;
}

export class BootstrapCache<T = unknown> {
    private entries = new Map<string, CacheEntry<T>>();
    private maxSize: number;
    private defaultTtlMs?: number;

    constructor(maxSize = 100, defaultTtlMs?: number) {
        this.maxSize = maxSize;
        this.defaultTtlMs = defaultTtlMs;
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt && Date.now() > entry.expiresAt) { this.entries.delete(key); return undefined; }
        entry.hitCount++;
        return entry.value;
    }

    set(key: string, value: T, ttlMs?: number): void {
        if (this.entries.size >= this.maxSize && !this.entries.has(key)) this.evictOldest();
        const effectiveTtl = ttlMs ?? this.defaultTtlMs;
        this.entries.set(key, {
            key, value, createdAt: Date.now(),
            expiresAt: effectiveTtl ? Date.now() + effectiveTtl : undefined,
            hitCount: 0,
        });
    }

    has(key: string): boolean {
        const entry = this.entries.get(key);
        if (!entry) return false;
        if (entry.expiresAt && Date.now() > entry.expiresAt) { this.entries.delete(key); return false; }
        return true;
    }

    delete(key: string): boolean { return this.entries.delete(key); }
    clear(): void { this.entries.clear(); }
    size(): number { return this.entries.size; }

    prune(): number {
        const now = Date.now();
        let pruned = 0;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt && now > entry.expiresAt) { this.entries.delete(key); pruned++; }
        }
        return pruned;
    }

    keys(): string[] { return [...this.entries.keys()]; }
    values(): T[] { return [...this.entries.values()].map((e) => e.value); }

    stats(): { size: number; maxSize: number; totalHits: number } {
        let totalHits = 0;
        for (const entry of this.entries.values()) totalHits += entry.hitCount;
        return { size: this.entries.size, maxSize: this.maxSize, totalHits };
    }

    private evictOldest(): void {
        let oldest: string | undefined;
        let oldestTime = Infinity;
        for (const [key, entry] of this.entries) {
            if (entry.createdAt < oldestTime) { oldest = key; oldestTime = entry.createdAt; }
        }
        if (oldest) this.entries.delete(oldest);
    }
}
