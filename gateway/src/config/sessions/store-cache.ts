/** CoreBlow — Session Store Cache */
const cache = new Map<string, { data: unknown; ts: number }>();
export function getFromStoreCache<T>(key: string, maxAgeMs = 30000): T | undefined { const e = cache.get(key); if (!e || Date.now() - e.ts > maxAgeMs) return undefined; return e.data as T; }
export function setInStoreCache(key: string, data: unknown): void { cache.set(key, { data, ts: Date.now() }); }
export function clearStoreCache(): void { cache.clear(); }
