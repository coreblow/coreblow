import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    normalizeSecretInput,
    readProviderEnvValue,
    providerRequiresCredential,
    hasProviderCredential,
} from './credential-resolver.js';
import type { WebSearchProviderEntry } from './types.js';

describe('Web Search Module', () => {
    describe('credential-resolver.ts', () => {
        describe('normalizeSecretInput', () => {
            it('trims and returns valid strings', () => {
                expect(normalizeSecretInput('  sk-abc  ')).toBe('sk-abc');
                expect(normalizeSecretInput('key')).toBe('key');
            });

            it('returns undefined for empty/whitespace strings', () => {
                expect(normalizeSecretInput('')).toBeUndefined();
                expect(normalizeSecretInput('   ')).toBeUndefined();
            });

            it('returns undefined for non-string values', () => {
                expect(normalizeSecretInput(undefined)).toBeUndefined();
                expect(normalizeSecretInput(null)).toBeUndefined();
                expect(normalizeSecretInput(42)).toBeUndefined();
                expect(normalizeSecretInput(true)).toBeUndefined();
            });
        });

        describe('readProviderEnvValue', () => {
            afterEach(() => {
                delete process.env.__TEST_SEARCH_KEY_A;
                delete process.env.__TEST_SEARCH_KEY_B;
            });

            it('reads first available env var', () => {
                process.env.__TEST_SEARCH_KEY_A = 'val-a';
                expect(readProviderEnvValue(['__TEST_SEARCH_KEY_A'])).toBe('val-a');
            });

            it('falls back to second env var if first is empty', () => {
                process.env.__TEST_SEARCH_KEY_A = '';
                process.env.__TEST_SEARCH_KEY_B = 'val-b';
                expect(readProviderEnvValue(['__TEST_SEARCH_KEY_A', '__TEST_SEARCH_KEY_B'])).toBe('val-b');
            });

            it('returns undefined when no env vars set', () => {
                expect(readProviderEnvValue(['__NONEXISTENT_VAR'])).toBeUndefined();
            });
        });

        describe('providerRequiresCredential', () => {
            it('returns true when requiresCredential is true', () => {
                expect(providerRequiresCredential({ requiresCredential: true })).toBe(true);
            });

            it('returns false when requiresCredential is false', () => {
                expect(providerRequiresCredential({ requiresCredential: false })).toBe(false);
            });
        });

        describe('hasProviderCredential', () => {
            const makeProvider = (overrides: Partial<WebSearchProviderEntry> = {}): WebSearchProviderEntry => ({
                id: 'test',
                envVars: [],
                requiresCredential: true,
                getCredentialValue: () => undefined,
                createTool: () => null,
                ...overrides,
            });

            it('returns true when provider does not require credentials', () => {
                const provider = makeProvider({ requiresCredential: false });
                expect(hasProviderCredential(provider, undefined, undefined)).toBe(true);
            });

            it('returns true when credential found via getCredentialValue', () => {
                const provider = makeProvider({
                    getCredentialValue: () => 'sk-found',
                });
                expect(hasProviderCredential(provider, undefined, {})).toBe(true);
            });

            it('returns true when credential found via getConfiguredCredentialValue', () => {
                const provider = makeProvider({
                    getConfiguredCredentialValue: () => 'configured-key',
                    getCredentialValue: () => undefined,
                });
                expect(hasProviderCredential(provider, {}, undefined)).toBe(true);
            });

            it('returns true when credential found via env var', () => {
                process.env.__TEST_WS_CRED = 'env-key';
                const provider = makeProvider({
                    envVars: ['__TEST_WS_CRED'],
                });
                expect(hasProviderCredential(provider, undefined, undefined)).toBe(true);
                delete process.env.__TEST_WS_CRED;
            });

            it('returns false when no credential available', () => {
                const provider = makeProvider({
                    envVars: ['__NONEXISTENT'],
                    getCredentialValue: () => undefined,
                });
                expect(hasProviderCredential(provider, undefined, undefined)).toBe(false);
            });
        });
    });
});
