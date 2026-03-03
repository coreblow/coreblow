/**
 * agents/provider-profiles/store.ts
 *
 * File-backed store dengan file locking + mtime cache.
 * CoreBlow — agents/auth-profiles/store.ts
 *
 * Adaptasi:
 * - Tidak ada credential management (CoreBlow tidak store API keys)
 * - Tidak ada legacy migration (baru, tidak ada format lama)
 * - Tidak ada external CLI sync (hanya gateway internal state)
 * - Tidak ada agentDir scoping (single global store)
 * - Gunakan CoreBlow infra/file-lock.ts + infra/json-files.ts
 *
 * @see coreblow/src/agents/auth-profiles/store.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { withFileLock } from '../../infra/file-lock.js';
import { createChildLogger } from '../../utils/logger.js';
import { PROVIDER_STORE_LOCK_OPTIONS, PROVIDER_STORE_VERSION } from './constants.js';
import { ensureProviderStoreFile, resolveProviderStorePath } from './paths.js';
import type { ProviderProfileStore, ProviderUsageStats } from './types.js';


const log = createChildLogger('agents/provider-profiles/store');

// ─── In-memory cache (mtime-based, port from OC) ────────────────────────────
// Tidak baca disk setiap request — hanya bila mtime berubah

const loadedStoreCache = new Map<
    string,
    { mtimeMs: number | null; syncedAtMs: number; store: ProviderProfileStore }
>();

function readStoreMtimeMs(storePath: string): number | null {
    try {
        return fs.statSync(storePath).mtimeMs;
    } catch {
        return null;
    }
}

function readCachedStore(storePath: string, mtimeMs: number | null): ProviderProfileStore | null {
    const cached = loadedStoreCache.get(storePath);
    if (!cached || cached.mtimeMs !== mtimeMs) return null;
    return cloneStore(cached.store);
}

function writeCachedStore(storePath: string, mtimeMs: number | null, store: ProviderProfileStore): void {
    loadedStoreCache.set(storePath, { mtimeMs, syncedAtMs: Date.now(), store: cloneStore(store) });
}

function cloneStore(store: ProviderProfileStore): ProviderProfileStore {
    return structuredClone(store);
}

// ─── Parse / coerce ──────────────────────────────────────────────────────────

function loadJsonFile(storePath: string): unknown {
    try {
        if (!fs.existsSync(storePath)) return undefined;
        return JSON.parse(fs.readFileSync(storePath, 'utf8')) as unknown;
    } catch {
        return undefined;
    }
}

function coerceProviderStore(raw: unknown): ProviderProfileStore | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const usageStats: Record<string, ProviderUsageStats> = {};
    if (record.usageStats && typeof record.usageStats === 'object') {
        for (const [key, value] of Object.entries(record.usageStats as Record<string, unknown>)) {
            if (value && typeof value === 'object') {
                usageStats[key] = value as ProviderUsageStats;
            }
        }
    }
    return {
        version: typeof record.version === 'number' ? record.version : PROVIDER_STORE_VERSION,
        usageStats,
        lastSavedAt: typeof record.lastSavedAt === 'number' ? record.lastSavedAt : undefined,
    };
}

function buildEmptyStore(): ProviderProfileStore {
    return { version: PROVIDER_STORE_VERSION, usageStats: {} };
}

// ─── Atomic write (port CoreBlow saveJsonFile pattern) ───────────────────────

function saveJsonFileSync(storePath: string, data: unknown): void {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(storePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    try { fs.chmodSync(storePath, 0o600); } catch { /* best-effort */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load provider-profiles store dari disk.
 * Gunakan mtime cache — tidak baca disk jika tidak ada perubahan.
 * CoreBlow — agents/auth-profiles/store.ts loadAuthProfileStore()
 */
export function loadProviderProfileStore(): ProviderProfileStore {
    const storePath = resolveProviderStorePath();
    const mtimeMs = readStoreMtimeMs(storePath);
    const cached = readCachedStore(storePath, mtimeMs);
    if (cached) return cached;

    const raw = loadJsonFile(storePath);
    const store = coerceProviderStore(raw) ?? buildEmptyStore();
    writeCachedStore(storePath, readStoreMtimeMs(storePath), store);
    return cloneStore(store);
}

/**
 * Save provider-profiles store ke disk dan update cache.
 * CoreBlow — agents/auth-profiles/store.ts saveAuthProfileStore()
 */
export function saveProviderProfileStore(store: ProviderProfileStore): void {
    const storePath = resolveProviderStorePath();
    const payload: ProviderProfileStore = {
        version: PROVIDER_STORE_VERSION,
        usageStats: store.usageStats,
        lastSavedAt: Date.now(),
    };
    saveJsonFileSync(storePath, payload);
    writeCachedStore(storePath, readStoreMtimeMs(storePath), payload);
}

/**
 * Atomic update dengan file lock.
 * Lock → load fresh from disk → apply updater → save if changed → release.
 * CoreBlow — agents/auth-profiles/store.ts updateAuthProfileStoreWithLock()
 */
export async function updateProviderProfileStoreWithLock(params: {
    updater: (store: ProviderProfileStore) => boolean;
}): Promise<ProviderProfileStore | null> {
    const storePath = resolveProviderStorePath();
    ensureProviderStoreFile(storePath);
    try {
        return await withFileLock(storePath, PROVIDER_STORE_LOCK_OPTIONS, async () => {
            // Load fresh dari disk (bukan dari cache) — hindari overwrite concurrent write
            const raw = loadJsonFile(storePath);
            const store = coerceProviderStore(raw) ?? buildEmptyStore();
            const shouldSave = params.updater(store);
            if (shouldSave) {
                saveProviderProfileStore(store);
            }
            return store;
        });
    } catch (err) {
        log.warn({ err }, 'updateProviderProfileStoreWithLock failed, falling back to no-lock write');
        return null;
    }
}

/**
 * Clear all in-memory caches (untuk testing).
 * CoreBlow — agents/auth-profiles/store.ts clearRuntimeAuthProfileStoreSnapshots()
 */
export function clearProviderProfileStoreCache(): void {
    loadedStoreCache.clear();
}
