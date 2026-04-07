/**
 * CoreBlow — Namespace Isolation
 *
 * Provides data isolation between tenants using
 * namespaced keys. Prevents cross-tenant data access.
 */

/** Namespace entry */
export interface NamespaceEntry {
    namespace: string;
    key: string;
    value: unknown;
    createdAt: number;
    updatedAt: number;
}

/**
 * CoreBlow Namespace Isolation
 */
export class NamespaceIsolation {
    private data = new Map<string, NamespaceEntry>();

    /**
     * Set a value in a namespace.
     */
    set(namespace: string, key: string, value: unknown): void {
        const fullKey = `${namespace}:${key}`;
        const existing = this.data.get(fullKey);
        this.data.set(fullKey, {
            namespace, key, value,
            createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now(),
        });
    }

    /**
     * Get a value from a namespace.
     */
    get(namespace: string, key: string): unknown | undefined {
        return this.data.get(`${namespace}:${key}`)?.value;
    }

    /**
     * Delete from a namespace.
     */
    delete(namespace: string, key: string): boolean {
        return this.data.delete(`${namespace}:${key}`);
    }

    /**
     * Check if key exists.
     */
    has(namespace: string, key: string): boolean {
        return this.data.has(`${namespace}:${key}`);
    }

    /**
     * List all keys in a namespace.
     */
    keys(namespace: string): string[] {
        return Array.from(this.data.values())
            .filter((e) => e.namespace === namespace)
            .map((e) => e.key);
    }

    /**
     * Get all entries in a namespace.
     */
    getAll(namespace: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const entry of Array.from(this.data.values())) {
            if (entry.namespace === namespace) result[entry.key] = entry.value;
        }
        return result;
    }

    /**
     * Clear entire namespace.
     */
    clearNamespace(namespace: string): number {
        let count = 0;
        for (const [key, entry] of Array.from(this.data)) {
            if (entry.namespace === namespace) { this.data.delete(key); count++; }
        }
        return count;
    }

    /**
     * List all namespaces.
     */
    listNamespaces(): Array<{ namespace: string; entryCount: number }> {
        const counts = new Map<string, number>();
        for (const entry of Array.from(this.data.values())) {
            counts.set(entry.namespace, (counts.get(entry.namespace) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([namespace, entryCount]) => ({ namespace, entryCount }));
    }

    /** Total count */
    count(): number { return this.data.size; }
}
