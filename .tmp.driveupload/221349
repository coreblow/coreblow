/**
 * CoreBlow — Cache Invalidation
 *
 * Manages cache invalidation patterns: tag-based,
 * pattern-based, event-driven, and TTL-based.
 */

/** Invalidation entry */
export interface InvalidationEntry {
    key: string;
    tags: string[];
    invalidatedAt?: number;
}

/**
 * CoreBlow Cache Invalidation
 */
export class CacheInvalidation {
    private entries = new Map<string, InvalidationEntry>();
    private tagIndex = new Map<string, Set<string>>(); // tag → keys
    private listeners: Array<(keys: string[]) => void> = [];
    private stats = { invalidated: 0, byTag: 0, byPattern: 0 };

    /**
     * Register a cache key with tags.
     */
    register(key: string, tags: string[]): void {
        this.entries.set(key, { key, tags });
        for (const tag of tags) {
            if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
            this.tagIndex.get(tag)!.add(key);
        }
    }

    /**
     * Invalidate by key.
     */
    invalidateKey(key: string): boolean {
        const entry = this.entries.get(key);
        if (!entry) return false;
        entry.invalidatedAt = Date.now();
        this.stats.invalidated++;
        this.notifyListeners([key]);
        return true;
    }

    /**
     * Invalidate by tag.
     */
    invalidateByTag(tag: string): string[] {
        const keys = this.tagIndex.get(tag);
        if (!keys || keys.size === 0) return [];
        const invalidated = Array.from(keys);
        for (const key of invalidated) {
            const entry = this.entries.get(key);
            if (entry) entry.invalidatedAt = Date.now();
        }
        this.stats.invalidated += invalidated.length;
        this.stats.byTag += invalidated.length;
        this.notifyListeners(invalidated);
        return invalidated;
    }

    /**
     * Invalidate by pattern (glob-like).
     */
    invalidateByPattern(pattern: string): string[] {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        const invalidated: string[] = [];
        for (const [key, entry] of Array.from(this.entries)) {
            if (regex.test(key)) {
                entry.invalidatedAt = Date.now();
                invalidated.push(key);
            }
        }
        this.stats.invalidated += invalidated.length;
        this.stats.byPattern += invalidated.length;
        this.notifyListeners(invalidated);
        return invalidated;
    }

    /**
     * Check if a key is invalidated.
     */
    isInvalidated(key: string): boolean {
        return this.entries.get(key)?.invalidatedAt !== undefined;
    }

    /**
     * On invalidation listener.
     */
    onInvalidate(fn: (keys: string[]) => void): void { this.listeners.push(fn); }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /** Count */
    count(): number { return this.entries.size; }

    // === Private ===
    private notifyListeners(keys: string[]): void {
        for (const fn of this.listeners) fn(keys);
    }
}
