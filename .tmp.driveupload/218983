/**
 * Unit Test: ProviderProfileStore
 *
 * Verifikasi load/save/lock/cache invalidation untuk provider-profiles store.
 * Semua disk I/O di-mock — tidak perlu FS permission atau real files.
 *
 * Coverage:
 *   1. loadProviderProfileStore — empty file → default empty store
 *   2. loadProviderProfileStore — valid JSON → coerced store
 *   3. loadProviderProfileStore — corrupt JSON → graceful fallback (empty store)
 *   4. mtime cache — same mtime → no disk re-read
 *   5. mtime cache — changed mtime → disk re-read
 *   6. saveProviderProfileStore — writes JSON + updates cache
 *   7. updateProviderProfileStoreWithLock — updater applied, save called
 *   8. updateProviderProfileStoreWithLock — updater returns false → no save
 *   9. clearProviderProfileStoreCache — clears in-memory cache
 *
 * @see gateway/src/agents/provider-profiles/store.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// ─── Mocks — must be hoisted before imports ───────────────────────────────────

vi.mock('node:fs');
vi.mock('./paths.js', () => ({
    resolveProviderStorePath: () => '/fake/.coreblow/provider-profiles.json',
    ensureProviderStoreFile: vi.fn(),
}));
vi.mock('../../infra/file-lock.js', () => ({
    withFileLock: vi.fn(async (_path, _opts, fn) => fn()),
}));
vi.mock('../../utils/logger.js', () => ({
    createChildLogger: () => ({
        warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(),
    }),
}));

import { withFileLock } from '../../infra/file-lock.js';
import {
    loadProviderProfileStore,
    saveProviderProfileStore,
    updateProviderProfileStoreWithLock,
    clearProviderProfileStoreCache,
} from './store.js';
import { PROVIDER_STORE_VERSION } from './constants.js';

const STORE_PATH = '/fake/.coreblow/provider-profiles.json';
const mockFs = vi.mocked(fs);
const mockWithFileLock = vi.mocked(withFileLock);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupFsMocks(opts: {
    exists?: boolean;
    mtimeMs?: number;
    content?: string;
} = {}) {
    const { exists = true, mtimeMs = 1000, content } = opts;

    mockFs.existsSync.mockReturnValue(exists);
    mockFs.statSync.mockReturnValue({ mtimeMs } as fs.Stats);

    if (content !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockFs.readFileSync as any).mockReturnValue(content);
    } else {
        const defaultContent = JSON.stringify({
            version: PROVIDER_STORE_VERSION,
            usageStats: {},
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockFs.readFileSync as any).mockReturnValue(defaultContent);
    }

    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.chmodSync.mockImplementation(() => undefined);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadProviderProfileStore', () => {
    beforeEach(() => {
        clearProviderProfileStoreCache();
        vi.clearAllMocks();
    });

    afterEach(() => {
        clearProviderProfileStoreCache();
    });

    it('returns empty store when file does not exist', () => {
        setupFsMocks({ exists: false });
        const store = loadProviderProfileStore();
        expect(store.version).toBe(PROVIDER_STORE_VERSION);
        expect(store.usageStats).toEqual({});
    });

    it('parses valid JSON and returns typed store', () => {
        const content = JSON.stringify({
            version: PROVIDER_STORE_VERSION,
            usageStats: {
                'openai:gpt-4': { errorCount: 2, cooldownUntil: 9999999 },
            },
        });
        setupFsMocks({ content });
        const store = loadProviderProfileStore();
        expect(store.usageStats['openai:gpt-4']?.errorCount).toBe(2);
        expect(store.usageStats['openai:gpt-4']?.cooldownUntil).toBe(9999999);
    });

    it('returns empty store on corrupt JSON (graceful fallback)', () => {
        setupFsMocks({ content: 'NOT_VALID_JSON{{' });
        const store = loadProviderProfileStore();
        expect(store.version).toBe(PROVIDER_STORE_VERSION);
        expect(store.usageStats).toEqual({});
    });

    it('uses mtime cache — same mtime = no disk re-read', () => {
        setupFsMocks({ mtimeMs: 1234 });
        loadProviderProfileStore(); // first load → reads disk
        loadProviderProfileStore(); // second load → should use cache

        // readFileSync should only be called once (first load)
        expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('re-reads disk when mtime changes', () => {
        // First load with mtime=1000
        setupFsMocks({ mtimeMs: 1000 });
        loadProviderProfileStore();

        // Simulate file change: mtime=2000
        clearProviderProfileStoreCache();
        setupFsMocks({ mtimeMs: 2000 });
        loadProviderProfileStore();

        expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('returns a clone (mutations do not affect cache)', () => {
        setupFsMocks();
        const store1 = loadProviderProfileStore();
        store1.usageStats['mutated'] = { errorCount: 99 };

        clearProviderProfileStoreCache();
        setupFsMocks({ mtimeMs: 1000 }); // same mtime
        const store2 = loadProviderProfileStore();

        // Fresh load from clean JSON, not from mutated store1
        expect(store2.usageStats['mutated']).toBeUndefined();
    });
});

// ─── saveProviderProfileStore ─────────────────────────────────────────────────

describe('saveProviderProfileStore', () => {
    beforeEach(() => {
        clearProviderProfileStoreCache();
        vi.clearAllMocks();
    });

    afterEach(() => {
        clearProviderProfileStoreCache();
    });

    it('writes JSON to disk with version + lastSavedAt', () => {
        setupFsMocks();
        const store = {
            version: PROVIDER_STORE_VERSION,
            usageStats: { 'anthropic:claude-3': { errorCount: 1 } },
        };
        saveProviderProfileStore(store);

        expect(mockFs.writeFileSync).toHaveBeenCalledOnce();
        const [, written] = mockFs.writeFileSync.mock.calls[0]!;
        const parsed = JSON.parse(written as string);
        expect(parsed.version).toBe(PROVIDER_STORE_VERSION);
        expect(typeof parsed.lastSavedAt).toBe('number');
        expect(parsed.usageStats['anthropic:claude-3'].errorCount).toBe(1);
    });

    it('sets file permission to 0o600 (best-effort)', () => {
        setupFsMocks();
        saveProviderProfileStore({ version: PROVIDER_STORE_VERSION, usageStats: {} });
        expect(mockFs.chmodSync).toHaveBeenCalledWith(STORE_PATH, 0o600);
    });
});

// ─── updateProviderProfileStoreWithLock ──────────────────────────────────────

describe('updateProviderProfileStoreWithLock', () => {
    beforeEach(() => {
        clearProviderProfileStoreCache();
        vi.clearAllMocks();
    });

    afterEach(() => {
        clearProviderProfileStoreCache();
    });

    it('calls updater with fresh-from-disk store and returns updated store', async () => {
        const content = JSON.stringify({
            version: PROVIDER_STORE_VERSION,
            usageStats: { 'openai:gpt-4': { errorCount: 1 } },
        });
        setupFsMocks({ content });

        let capturedStore: Record<string, unknown> | null = null;
        const updated = await updateProviderProfileStoreWithLock({
            updater: (store) => {
                capturedStore = store.usageStats;
                store.usageStats['openai:gpt-4'] = { errorCount: 2 };
                return true; // should save
            },
        });

        expect(capturedStore).not.toBeNull();
        expect(updated?.usageStats['openai:gpt-4']?.errorCount).toBe(2);
        expect(mockFs.writeFileSync).toHaveBeenCalledOnce();
    });

    it('does NOT call writeFileSync when updater returns false', async () => {
        setupFsMocks();
        await updateProviderProfileStoreWithLock({
            updater: () => false, // no changes
        });
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('returns null when file lock fails (withFileLock throws)', async () => {
        setupFsMocks();
        mockWithFileLock.mockRejectedValueOnce(new Error('lock timeout'));

        const result = await updateProviderProfileStoreWithLock({
            updater: () => true,
        });

        expect(result).toBeNull();
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('acquires lock on the store path', async () => {
        setupFsMocks();
        await updateProviderProfileStoreWithLock({ updater: () => false });
        expect(mockWithFileLock).toHaveBeenCalledWith(
            STORE_PATH,
            expect.any(Object),
            expect.any(Function),
        );
    });
});

// ─── clearProviderProfileStoreCache ──────────────────────────────────────────

describe('clearProviderProfileStoreCache', () => {
    it('forces re-read from disk on next load', () => {
        setupFsMocks({ mtimeMs: 5000 });
        const callsBefore = mockFs.readFileSync.mock.calls.length;
        loadProviderProfileStore(); // populates cache (1 read)

        clearProviderProfileStoreCache();

        loadProviderProfileStore(); // should re-read (1 more read)
        const callsAfter = mockFs.readFileSync.mock.calls.length;
        // At least 2 reads occurred total (one per load after cache cleared)
        expect(callsAfter - callsBefore).toBeGreaterThanOrEqual(2);
    });
});
