/**
 * CoreBlow — Lazy Loader
 *
 * Lazy initialization of expensive resources with
 * caching, TTL, and dependency-aware loading.
 */

/** Lazy resource */
interface LazyResource<T> {
    name: string;
    factory: () => Promise<T>;
    instance?: T;
    loaded: boolean;
    loadedAt?: number;
    ttlMs?: number;
    loading: boolean;
    deps: string[];
}

/**
 * CoreBlow Lazy Loader
 */
export class LazyLoader {
    private resources = new Map<string, LazyResource<unknown>>();
    private stats = { loaded: 0, cached: 0, reloaded: 0 };

    /**
     * Register a lazy resource.
     */
    register<T>(name: string, factory: () => Promise<T>, options?: { ttlMs?: number; deps?: string[] }): void {
        this.resources.set(name, {
            name, factory, loaded: false, loading: false,
            ttlMs: options?.ttlMs, deps: options?.deps ?? [],
        });
    }

    /**
     * Get a resource (loads on first access).
     */
    async get<T>(name: string): Promise<T | null> {
        const resource = this.resources.get(name) as LazyResource<T> | undefined;
        if (!resource) return null;

        // Check TTL
        if (resource.loaded && resource.ttlMs && resource.loadedAt) {
            if (Date.now() - resource.loadedAt > resource.ttlMs) {
                resource.loaded = false;
                this.stats.reloaded++;
            }
        }

        // Return cached
        if (resource.loaded) { this.stats.cached++; return resource.instance as T; }

        // Load deps first
        for (const dep of resource.deps) {
            await this.get(dep);
        }

        // Load
        resource.loading = true;
        try {
            resource.instance = await resource.factory();
            resource.loaded = true;
            resource.loadedAt = Date.now();
            this.stats.loaded++;
        } finally {
            resource.loading = false;
        }

        return resource.instance as T;
    }

    /**
     * Check if loaded.
     */
    isLoaded(name: string): boolean {
        return this.resources.get(name)?.loaded ?? false;
    }

    /**
     * Invalidate (force reload next access).
     */
    invalidate(name: string): boolean {
        const resource = this.resources.get(name);
        if (!resource) return false;
        resource.loaded = false;
        resource.instance = undefined;
        return true;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List resources.
     */
    list(): Array<{ name: string; loaded: boolean; deps: string[] }> {
        return Array.from(this.resources.values()).map((r) => ({ name: r.name, loaded: r.loaded, deps: r.deps }));
    }

    /** Count */
    count(): number { return this.resources.size; }
}
