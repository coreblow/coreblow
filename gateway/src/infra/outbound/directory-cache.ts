/** CoreBlow — Directory Cache */
const cache = new Map<string, { value: unknown; expiresAt: number }>();
export function getCached<T>(key: string): T | undefined { const entry = cache.get(key); if (!entry || Date.now() > entry.expiresAt) { cache.delete(key); return undefined; } return entry.value as T; }
export function setCached(key: string, value: unknown, ttlMs = 60000): void { cache.set(key, { value, expiresAt: Date.now() + ttlMs }); }
export function clearDirectoryCache(): void { cache.clear(); }
