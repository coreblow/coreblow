/** Subagent registry read operations. */
export function getRegistrySnapshot<T>(registry: Map<string, T>): Array<[string, T]> { return [...registry.entries()]; }
export function findInRegistry<T>(registry: Map<string, T>, predicate: (v: T) => boolean): T | undefined { for (const v of registry.values()) { if (predicate(v)) return v; } return undefined; }
