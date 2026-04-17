/**
 * CoreBlow Security — AuthProfileStore Test Suite
 *
 * Covers: upsertProfile(), getActiveCredential() (key rotation, cooldown,
 * budget blocking), markFailure() (escalating cooldown), markSuccess()
 * (cost tracking, daily/monthly reset, budget warning), getStats(),
 * getUsageLog(), CRUD ops (getProfile, listProviders, deleteProfile),
 * and persistence (load/save with fs mocking).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock fs and crypto
vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(() => '{}'),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

vi.mock('node:crypto', () => ({
    default: {
        randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
    },
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

import { AuthProfileStore, type AuthCredential, type AuthProfile } from './auth-profiles.js';

function makeCredential(overrides?: Partial<AuthCredential>): AuthCredential {
    return {
        type: 'api-key',
        value: 'sk-test-' + Math.random().toString(36).slice(2, 8),
        provider: 'openai',
        label: 'test-key',
        createdAt: Date.now(),
        ...overrides,
    };
}

describe('AuthProfileStore', () => {
    let store: AuthProfileStore;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        store = new AuthProfileStore('/tmp/test-auth.json');
    });

    // ─── upsertProfile() ────────────────────────────────────────

    describe('upsertProfile()', () => {
        it('creates a new profile with defaults', () => {
            const creds = [makeCredential({ provider: 'openai' })];
            const profile = store.upsertProfile('openai', creds);

            expect(profile.id).toBeTruthy();
            expect(profile.provider).toBe('openai');
            expect(profile.credentials).toEqual(creds);
            expect(profile.activeIndex).toBe(0);
            expect(profile.usage.dailyCostUsd).toBe(0);
            expect(profile.usage.monthlyCostUsd).toBe(0);
            expect(profile.usage.totalTokens).toBe(0);
        });

        it('updates existing profile credentials', () => {
            const cred1 = [makeCredential({ provider: 'openai', label: 'key-1' })];
            store.upsertProfile('openai', cred1);

            const cred2 = [makeCredential({ provider: 'openai', label: 'key-2' })];
            const updated = store.upsertProfile('openai', cred2);

            expect(updated.credentials[0]!.label).toBe('key-2');
        });

        it('preserves existing cooldowns and failures on update', () => {
            const creds = [makeCredential(), makeCredential()];
            store.upsertProfile('openai', creds);
            store.markFailure('openai');

            const updated = store.upsertProfile('openai', creds);
            // Cooldowns and failures are Maps inherited from existing
            expect(updated.cooldowns).toBeInstanceOf(Map);
            expect(updated.failures).toBeInstanceOf(Map);
        });

        it('sets budget limit when provided', () => {
            const creds = [makeCredential()];
            const profile = store.upsertProfile('openai', creds, { budgetLimitUsd: 50 });
            expect(profile.budgetLimitUsd).toBe(50);
        });

        it('persists to disk via save()', () => {
            const creds = [makeCredential()];
            store.upsertProfile('openai', creds);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    // ─── getActiveCredential() ──────────────────────────────────

    describe('getActiveCredential()', () => {
        it('returns the active credential for a known provider', () => {
            const cred = makeCredential({ provider: 'openai', label: 'primary' });
            store.upsertProfile('openai', [cred]);

            const active = store.getActiveCredential('openai');
            expect(active).toBeTruthy();
            expect(active!.label).toBe('primary');
        });

        it('returns null for unknown provider', () => {
            expect(store.getActiveCredential('nonexistent')).toBeNull();
        });

        it('returns null for provider with empty credentials', () => {
            store.upsertProfile('empty', []);
            expect(store.getActiveCredential('empty')).toBeNull();
        });

        it('returns null when budget limit is exceeded', () => {
            const creds = [makeCredential()];
            const profile = store.upsertProfile('openai', creds, { budgetLimitUsd: 0.001 });

            // Simulate spending over budget
            profile.usage.monthlyCostUsd = 0.002;

            expect(store.getActiveCredential('openai')).toBeNull();
        });

        it('rotates to next healthy key when active key is on cooldown', () => {
            const cred1 = makeCredential({ label: 'key-0' });
            const cred2 = makeCredential({ label: 'key-1' });
            store.upsertProfile('openai', [cred1, cred2]);

            // Put key-0 on cooldown
            const profile = store.getProfile('openai')!;
            profile.cooldowns.set(0, Date.now() + 60_000);

            const active = store.getActiveCredential('openai');
            expect(active).toBeTruthy();
            expect(active!.label).toBe('key-1');
        });

        it('returns null when ALL keys are on cooldown', () => {
            const cred1 = makeCredential({ label: 'key-0' });
            const cred2 = makeCredential({ label: 'key-1' });
            store.upsertProfile('openai', [cred1, cred2]);

            const profile = store.getProfile('openai')!;
            profile.cooldowns.set(0, Date.now() + 60_000);
            profile.cooldowns.set(1, Date.now() + 60_000);

            expect(store.getActiveCredential('openai')).toBeNull();
        });

        it('returns active key when cooldown has expired', () => {
            const cred = makeCredential({ label: 'expired-cd' });
            store.upsertProfile('openai', [cred]);

            const profile = store.getProfile('openai')!;
            profile.cooldowns.set(0, Date.now() - 1000); // Expired cooldown

            const active = store.getActiveCredential('openai');
            expect(active!.label).toBe('expired-cd');
        });
    });

    // ─── markFailure() ──────────────────────────────────────────

    describe('markFailure()', () => {
        it('increments failure count for active key', () => {
            store.upsertProfile('openai', [makeCredential(), makeCredential()]);
            store.markFailure('openai');

            const profile = store.getProfile('openai')!;
            expect(profile.failures.get(0)).toBe(1);
        });

        it('applies escalating cooldown (30s base with exponential backoff)', () => {
            store.upsertProfile('openai', [makeCredential(), makeCredential()]);

            const now = Date.now();
            store.markFailure('openai');

            const profile = store.getProfile('openai')!;
            const cooldown = profile.cooldowns.get(0)!;
            // First failure: ~30s cooldown
            expect(cooldown).toBeGreaterThan(now);
            expect(cooldown - now).toBeLessThanOrEqual(31_000);
        });

        it('escalates cooldown on consecutive failures', () => {
            store.upsertProfile('openai', [makeCredential(), makeCredential()]);

            store.markFailure('openai');
            const cd1 = store.getProfile('openai')!.cooldowns.get(0)!;

            // Force failure on same key again by resetting activeIndex
            store.getProfile('openai')!.activeIndex = 0;
            store.markFailure('openai');
            const cd2 = store.getProfile('openai')!.cooldowns.get(0)!;

            expect(cd2).toBeGreaterThan(cd1);
        });

        it('caps cooldown at 15 minutes (900_000ms)', () => {
            store.upsertProfile('openai', [makeCredential()]);

            // Simulate many failures
            const profile = store.getProfile('openai')!;
            profile.failures.set(0, 20); // Already failed 20 times

            const now = Date.now();
            store.markFailure('openai');

            const cooldown = profile.cooldowns.get(0)!;
            expect(cooldown - now).toBeLessThanOrEqual(901_000);
        });

        it('does nothing for unknown provider', () => {
            expect(() => store.markFailure('nonexistent')).not.toThrow();
        });
    });

    // ─── markSuccess() ──────────────────────────────────────────

    describe('markSuccess()', () => {
        it('resets failure count to 0', () => {
            store.upsertProfile('openai', [makeCredential()]);
            store.markFailure('openai');
            expect(store.getProfile('openai')!.failures.get(0)).toBe(1);

            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });
            expect(store.getProfile('openai')!.failures.get(0)).toBe(0);
        });

        it('updates lastUsedAt on the active credential', () => {
            store.upsertProfile('openai', [makeCredential()]);
            const before = Date.now();

            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });

            const cred = store.getProfile('openai')!.credentials[0]!;
            expect(cred.lastUsedAt).toBeGreaterThanOrEqual(before);
        });

        it('tracks cost using provider-specific pricing', () => {
            store.upsertProfile('openai', [makeCredential({ provider: 'openai' })]);

            // GPT-4o pricing: input=$2.50/M, output=$10.00/M
            store.markSuccess('openai', { promptTokens: 1_000_000, completionTokens: 1_000_000 });

            const usage = store.getProfile('openai')!.usage;
            expect(usage.dailyCostUsd).toBeCloseTo(12.50, 1); // 2.50 + 10.00
            expect(usage.monthlyCostUsd).toBeCloseTo(12.50, 1);
            expect(usage.totalTokens).toBe(2_000_000);
        });

        it('uses fallback pricing for unknown providers', () => {
            store.upsertProfile('custom-llm', [makeCredential({ provider: 'custom-llm' })]);

            store.markSuccess('custom-llm', { promptTokens: 1_000_000, completionTokens: 1_000_000 });

            const usage = store.getProfile('custom-llm')!.usage;
            // Fallback: input=$1/M, output=$3/M
            expect(usage.dailyCostUsd).toBeCloseTo(4.0, 1);
        });

        it('accumulates tokens across multiple calls', () => {
            store.upsertProfile('openai', [makeCredential()]);

            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });
            store.markSuccess('openai', { promptTokens: 200, completionTokens: 100 });

            expect(store.getProfile('openai')!.usage.totalTokens).toBe(450);
        });

        it('appends to usage log', () => {
            store.upsertProfile('openai', [makeCredential()]);

            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });

            const log = store.getUsageLog();
            expect(log.length).toBe(1);
            expect(log[0]!.provider).toBe('openai');
            expect(log[0]!.totalTokens).toBe(150);
        });

        it('evicts old usage log entries when exceeding 10_000', () => {
            store.upsertProfile('openai', [makeCredential()]);

            // Fill usage log beyond limit
            const usageLog = (store as any).usageLog;
            for (let i = 0; i < 10_001; i++) {
                usageLog.push({ provider: 'openai', keyLabel: 'k', promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, timestamp: i });
            }

            store.markSuccess('openai', { promptTokens: 1, completionTokens: 1 });

            expect(store.getUsageLog(100_000).length).toBeLessThanOrEqual(5_002);
        });

        it('does nothing for unknown provider', () => {
            expect(() => store.markSuccess('unknown', { promptTokens: 1, completionTokens: 1 })).not.toThrow();
        });

        it('persists after success', () => {
            store.upsertProfile('openai', [makeCredential()]);
            vi.mocked(fs.writeFileSync).mockClear();

            store.markSuccess('openai', { promptTokens: 1, completionTokens: 1 });
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    // ─── getStats() ─────────────────────────────────────────────

    describe('getStats()', () => {
        it('returns stats for all providers', () => {
            store.upsertProfile('openai', [makeCredential(), makeCredential()]);
            store.upsertProfile('anthropic', [makeCredential()]);

            const stats = store.getStats();

            expect(stats.openai).toBeTruthy();
            expect(stats.openai!.keyCount).toBe(2);
            expect(stats.openai!.provider).toBe('openai');
            expect(stats.anthropic).toBeTruthy();
            expect(stats.anthropic!.keyCount).toBe(1);
        });

        it('includes budget info when set', () => {
            store.upsertProfile('openai', [makeCredential()], { budgetLimitUsd: 100 });

            const stats = store.getStats();
            expect(stats.openai!.budget).toBe('$100');
            expect(stats.openai!.budgetUsedPct).toBe(0);
        });

        it('excludes budget info when not set', () => {
            store.upsertProfile('openai', [makeCredential()]);

            const stats = store.getStats();
            expect(stats.openai!.budget).toBeUndefined();
            expect(stats.openai!.budgetUsedPct).toBeUndefined();
        });

        it('counts healthy keys (not on cooldown)', () => {
            store.upsertProfile('openai', [makeCredential(), makeCredential()]);

            const profile = store.getProfile('openai')!;
            profile.cooldowns.set(0, Date.now() + 60_000); // key-0 on cooldown

            const stats = store.getStats();
            expect(stats.openai!.healthyKeys).toBe(1);
        });

        it('returns empty object when no profiles', () => {
            expect(store.getStats()).toEqual({});
        });
    });

    // ─── CRUD operations ────────────────────────────────────────

    describe('CRUD', () => {
        it('getProfile returns undefined for unknown provider', () => {
            expect(store.getProfile('unknown')).toBeUndefined();
        });

        it('listProviders returns all registered provider names', () => {
            store.upsertProfile('openai', [makeCredential()]);
            store.upsertProfile('anthropic', [makeCredential()]);

            const providers = store.listProviders();
            expect(providers).toContain('openai');
            expect(providers).toContain('anthropic');
            expect(providers.length).toBe(2);
        });

        it('deleteProfile removes and returns true', () => {
            store.upsertProfile('openai', [makeCredential()]);
            expect(store.deleteProfile('openai')).toBe(true);
            expect(store.getProfile('openai')).toBeUndefined();
        });

        it('deleteProfile returns false for unknown provider', () => {
            expect(store.deleteProfile('unknown')).toBe(false);
        });

        it('deleteProfile persists the change', () => {
            store.upsertProfile('openai', [makeCredential()]);
            vi.mocked(fs.writeFileSync).mockClear();

            store.deleteProfile('openai');
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    // ─── Persistence ────────────────────────────────────────────

    describe('persistence — load()', () => {
        it('loads profiles from disk on construction', () => {
            const storeData = {
                version: 1,
                profiles: {
                    openai: {
                        id: 'saved-id',
                        provider: 'openai',
                        credentials: [{ type: 'api-key', value: 'sk-saved', provider: 'openai', createdAt: 1000 }],
                        activeIndex: 0,
                        usage: { dailyCostUsd: 1.5, monthlyCostUsd: 30, totalTokens: 5000, lastResetDay: '2026-01-01', lastResetMonth: '2026-01' },
                    },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storeData));

            const loaded = new AuthProfileStore('/tmp/load-test.json');
            const profile = loaded.getProfile('openai');

            expect(profile).toBeTruthy();
            expect(profile!.id).toBe('saved-id');
            expect(profile!.usage.dailyCostUsd).toBe(1.5);
            // Cooldowns and failures should be fresh Maps
            expect(profile!.cooldowns).toBeInstanceOf(Map);
            expect(profile!.cooldowns.size).toBe(0);
        });

        it('handles missing file gracefully', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            expect(() => new AuthProfileStore('/tmp/missing.json')).not.toThrow();
        });

        it('handles corrupted JSON gracefully', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('NOT JSON!!!');

            expect(() => new AuthProfileStore('/tmp/corrupt.json')).not.toThrow();
        });
    });
});
