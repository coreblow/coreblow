/**
 * tests/unit/auth-profiles.test.ts
 * Tests for auth profiles + cost tracking
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AuthProfileStore } from '../../src/security/auth-profiles.js';

describe('AuthProfileStore', () => {
    let store: AuthProfileStore;
    let tmpPath: string;

    beforeEach(() => {
        tmpPath = path.join(os.tmpdir(), `coreblow-auth-test-${Date.now()}.json`);
        store = new AuthProfileStore(tmpPath);
    });

    afterEach(() => {
        try { fs.unlinkSync(tmpPath); } catch { }
    });

    it('should create a profile', () => {
        const profile = store.upsertProfile('openai', [
            { type: 'api-key', value: 'sk-test-1', provider: 'openai', createdAt: Date.now() },
        ]);
        expect(profile.provider).toBe('openai');
        expect(profile.credentials.length).toBe(1);
    });

    it('should get active credential', () => {
        store.upsertProfile('openai', [
            { type: 'api-key', value: 'sk-test-1', provider: 'openai', createdAt: Date.now() },
        ]);
        const cred = store.getActiveCredential('openai');
        expect(cred).toBeTruthy();
        expect(cred!.value).toBe('sk-test-1');
    });

    it('should rotate keys on failure', () => {
        store.upsertProfile('openai', [
            { type: 'api-key', value: 'sk-key-1', provider: 'openai', createdAt: Date.now() },
            { type: 'api-key', value: 'sk-key-2', provider: 'openai', createdAt: Date.now() },
        ]);
        store.markFailure('openai', 'rate limited');
        const cred = store.getActiveCredential('openai');
        expect(cred!.value).toBe('sk-key-2');
    });

    it('should track cost on success', () => {
        store.upsertProfile('openai', [
            { type: 'api-key', value: 'sk-test', provider: 'openai', createdAt: Date.now() },
        ]);
        store.markSuccess('openai', { promptTokens: 1000, completionTokens: 500 });
        const stats = store.getStats();
        expect(stats.openai.totalTokens).toBe(1500);
        expect(parseFloat(stats.openai.dailyCost.replace('$', ''))).toBeGreaterThan(0);
    });

    it('should enforce budget limits', () => {
        store.upsertProfile('openai', [
            { type: 'api-key', value: 'sk-test', provider: 'openai', createdAt: Date.now() },
        ], { budgetLimitUsd: 0.001 });

        // Spend a lot
        for (let i = 0; i < 100; i++) {
            store.markSuccess('openai', { promptTokens: 10000, completionTokens: 10000 });
        }

        const cred = store.getActiveCredential('openai');
        expect(cred).toBeNull(); // Budget exceeded
    });

    it('should return null for unknown provider', () => {
        expect(store.getActiveCredential('nonexistent')).toBeNull();
    });

    it('should list providers', () => {
        store.upsertProfile('openai', [{ type: 'api-key', value: 'x', provider: 'openai', createdAt: Date.now() }]);
        store.upsertProfile('gemini', [{ type: 'api-key', value: 'x', provider: 'gemini', createdAt: Date.now() }]);
        expect(store.listProviders()).toContain('openai');
        expect(store.listProviders()).toContain('gemini');
    });

    it('should delete profile', () => {
        store.upsertProfile('openai', [{ type: 'api-key', value: 'x', provider: 'openai', createdAt: Date.now() }]);
        expect(store.deleteProfile('openai')).toBe(true);
        expect(store.getProfile('openai')).toBeUndefined();
    });

    it('should persist to disk', () => {
        store.upsertProfile('openai', [{ type: 'api-key', value: 'sk-persist', provider: 'openai', createdAt: Date.now() }]);
        expect(fs.existsSync(tmpPath)).toBe(true);

        const store2 = new AuthProfileStore(tmpPath);
        const cred = store2.getActiveCredential('openai');
        expect(cred!.value).toBe('sk-persist');
    });

    it('should get usage log', () => {
        store.upsertProfile('openai', [{ type: 'api-key', value: 'x', provider: 'openai', createdAt: Date.now() }]);
        store.markSuccess('openai', { promptTokens: 100, completionTokens: 50 });
        store.markSuccess('openai', { promptTokens: 200, completionTokens: 100 });
        const log = store.getUsageLog();
        expect(log.length).toBe(2);
        expect(log[0].provider).toBe('openai');
    });
});
