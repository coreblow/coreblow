/**
 * src/shared/global-singleton.ts
 * Safe process-local cache/registry resolution.
 * Ported from CoreBlow shared/global-singleton.ts.
 */

// Safe for process-local caches and registries that can tolerate helper-based
// resolution. Do not use this for live mutable state that must survive split
// runtime chunks; keep those on a direct globalThis[Symbol.for(...)] lookup.
export function resolveGlobalSingleton<T>(key: symbol, create: () => T): T {
    const globalStore = globalThis as Record<PropertyKey, unknown>;
    if (Object.prototype.hasOwnProperty.call(globalStore, key)) {
        return globalStore[key] as T;
    }
    const created = create();
    globalStore[key] = created;
    return created;
}

export function resolveGlobalMap<TKey, TValue>(key: symbol): Map<TKey, TValue> {
    return resolveGlobalSingleton(key, () => new Map<TKey, TValue>());
}

// Helper wrapper for more idiomatic string keys
export function getOrCreateGlobalSingleton<T>(key: string, factory: () => T): T {
    return resolveGlobalSingleton(Symbol.for(`coreblow.global.${key}`), factory);
}
