/** CoreBlow — PI Cache TTL */ export const DEFAULT_CACHE_TTL_MS = 300_000; export function isCacheValid(cachedAt: number, ttl = DEFAULT_CACHE_TTL_MS): boolean { return Date.now() - cachedAt < ttl; }
