/** CoreBlow — Config Cache Utils */
const configCache = new Map<string, { value: unknown; timestamp: number }>();
export function getCachedConfig<T>(key: string, maxAgeMs = 60_000): T | undefined { const entry = configCache.get(key); if (!entry || Date.now() - entry.timestamp > maxAgeMs) { configCache.delete(key); return undefined; } return entry.value as T; }
export function setCachedConfig(key: string, value: unknown): void { configCache.set(key, { value, timestamp: Date.now() }); }
export function invalidateConfigCache(key?: string): void { if (key) configCache.delete(key); else configCache.clear(); }
