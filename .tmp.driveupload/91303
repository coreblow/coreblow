/**
 * agents/context-cache.ts
 * Context window caching — prompt caching for providers that support it.
 */
export interface CachedPromptEntry { key: string; hash: string; tokens: number; createdAt: number; expiresAt: number; provider: string; model: string; hitCount: number; }

export class ContextCache {
    private entries = new Map<string, CachedPromptEntry>();
    private maxEntries: number;
    constructor(maxEntries = 50) { this.maxEntries = maxEntries; }

    set(key: string, entry: Omit<CachedPromptEntry, 'hitCount'>): void {
        if (this.entries.size >= this.maxEntries) this.evictExpired() || this.evictLRU();
        this.entries.set(key, { ...entry, hitCount: 0 });
    }

    get(key: string): CachedPromptEntry | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) { this.entries.delete(key); return undefined; }
        entry.hitCount++;
        return entry;
    }

    has(key: string): boolean { return this.get(key) !== undefined; }
    delete(key: string): boolean { return this.entries.delete(key); }
    clear(): void { this.entries.clear(); }
    size(): number { return this.entries.size; }

    evictExpired(): boolean {
        const now = Date.now();
        let evicted = false;
        for (const [key, entry] of this.entries) { if (now > entry.expiresAt) { this.entries.delete(key); evicted = true; } }
        return evicted;
    }

    private evictLRU(): void {
        let lruKey: string | undefined;
        let lruHits = Infinity;
        for (const [key, entry] of this.entries) { if (entry.hitCount < lruHits) { lruKey = key; lruHits = entry.hitCount; } }
        if (lruKey) this.entries.delete(lruKey);
    }

    stats(): { size: number; totalHits: number; totalTokensCached: number } {
        let totalHits = 0, totalTokens = 0;
        for (const e of this.entries.values()) { totalHits += e.hitCount; totalTokens += e.tokens; }
        return { size: this.entries.size, totalHits, totalTokensCached: totalTokens };
    }
}
