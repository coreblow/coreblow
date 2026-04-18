/** CoreBlow — Runtime Overrides */
const overrides = new Map<string, unknown>();
export function setRuntimeOverride(key: string, value: unknown): void { overrides.set(key, value); }
export function getRuntimeOverride<T>(key: string): T | undefined { return overrides.get(key) as T | undefined; }
export function clearRuntimeOverrides(): void { overrides.clear(); }
export function hasRuntimeOverride(key: string): boolean { return overrides.has(key); }
