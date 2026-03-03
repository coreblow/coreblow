import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { AuthProfileStore } from './auth-profiles.js';
import type { AuthCredential } from './auth-profiles.js';

describe('AuthProfileStore', () => {
    let store: AuthProfileStore;
    const cred = (provider: string, label: string): AuthCredential => ({
        type: 'api-key',
        value: `sk-test-${label}`,
        provider,
        label,
        createdAt: Date.now(),
    });

    beforeEach(() => {
        store = new AuthProfileStore('/tmp/test-auth-profiles.json');
    });

    describe('upsertProfile', () => {
        it('should create a new profile', () => {
            const profile = store.upsertProfile('openai', [cred('openai', 'key-1')]);
            expect(profile.id).toBeDefined();
            expect(profile.provider).toBe('openai');
            expect(profile.credentials).toHaveLength(1);
        });

        it('should preserve existing usage on update', () => {
            store.upsertProfile('openai', [cred('openai', 'key-1')]);
            store.markSuccess('openai', { promptTokens: 1000, completionTokens: 500 });
            const updated = store.upsertProfile('openai', [cred('openai', 'key-1'), cred('openai', 'key-2')]);
            expect(updated.credentials).toHaveLength(2);
            expect(updated.usage.totalTokens).toBeGreaterThan(0);
        });

        it('should set budget limit', () => {
            const profile = store.upsertProfile('openai', [cred('openai', 'k')], { budgetLimitUsd: 100 });
            expect(profile.budgetLimitUsd).toBe(100);
        });
    });

    describe('getActiveCredential', () => {
        it('should return the active credential', () => {
            store.upsertProfile('openai', [cred('openai', 'k1'), cred('openai', 'k2')]);
            const active = store.getActiveCredential('openai');
            expect(active).toBeDefined();
            expect(active!.label).toBe('k1');
        });

        it('should return null for unknown provider', () => {
            expect(store.getActiveCredential('unknown')).toBeNull();
        });

        it('should return null when budget exceeded', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')], { budgetLimitUsd: 10 });
            const profile = store.getProfile('openai')!;
            profile.usage.monthlyCostUsd = 15;
            expect(store.getActiveCredential('openai')).toBeNull();
        });
    });

    describe('markFailure', () => {
        it('should set cooldown on failed key', () => {
            store.upsertProfile('openai', [cred('openai', 'k1'), cred('openai', 'k2')]);
            store.markFailure('openai', 'rate-limited');
            const profile = store.getProfile('openai')!;
            expect(profile.failures.get(0)).toBe(1);
            expect(profile.cooldowns.get(0)).toBeGreaterThan(Date.now());
        });

        it('should auto-rotate to next key after failure', () => {
            store.upsertProfile('openai', [cred('openai', 'k1'), cred('openai', 'k2')]);
            store.markFailure('openai');
            const active = store.getActiveCredential('openai');
            expect(active!.label).toBe('k2');
        });

        it('should do nothing for unknown provider', () => {
            expect(() => store.markFailure('unknown')).not.toThrow();
        });
    });

    describe('markSuccess', () => {
        it('should reset failure count', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')]);
            store.markFailure('openai');
            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });
            expect(store.getProfile('openai')!.failures.get(0)).toBe(0);
        });

        it('should track cost', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')]);
            store.markSuccess('openai', { promptTokens: 1_000_000, completionTokens: 1_000_000 });
            const profile = store.getProfile('openai')!;
            expect(profile.usage.dailyCostUsd).toBeGreaterThan(0);
            expect(profile.usage.monthlyCostUsd).toBeGreaterThan(0);
            expect(profile.usage.totalTokens).toBe(2_000_000);
        });

        it('should log usage', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')]);
            store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });
            const log = store.getUsageLog();
            expect(log).toHaveLength(1);
            expect(log[0].provider).toBe('openai');
        });

        it('should use free cost for ollama', () => {
            store.upsertProfile('ollama', [cred('ollama', 'k1')]);
            store.markSuccess('ollama', { promptTokens: 1_000_000, completionTokens: 1_000_000 });
            const profile = store.getProfile('ollama')!;
            expect(profile.usage.dailyCostUsd).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return stats for all providers', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')]);
            store.upsertProfile('gemini', [cred('gemini', 'k1')]);
            const stats = store.getStats();
            expect(Object.keys(stats)).toHaveLength(2);
            expect(stats['openai'].provider).toBe('openai');
            expect(stats['gemini'].provider).toBe('gemini');
        });

        it('should include budget info when set', () => {
            store.upsertProfile('openai', [cred('openai', 'k1')], { budgetLimitUsd: 50 });
            const stats = store.getStats();
            expect(stats['openai'].budget).toBe('$50');
        });
    });

    describe('listProviders & deleteProfile', () => {
        it('should list all providers', () => {
            store.upsertProfile('openai', [cred('openai', 'k')]);
            store.upsertProfile('anthropic', [cred('anthropic', 'k')]);
            expect(store.listProviders()).toEqual(expect.arrayContaining(['openai', 'anthropic']));
        });

        it('should delete a profile', () => {
            store.upsertProfile('openai', [cred('openai', 'k')]);
            expect(store.deleteProfile('openai')).toBe(true);
            expect(store.getProfile('openai')).toBeUndefined();
        });

        it('should return false for non-existent delete', () => {
            expect(store.deleteProfile('nonexistent')).toBe(false);
        });
    });
});
