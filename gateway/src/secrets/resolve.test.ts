/**
 * secrets/resolve.test.ts — Secret resolution engine tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSecretRefs, SecretProviderResolutionError, SecretRefResolutionError } from './resolve.js';
import type { SecretRef } from './types.js';

describe('Secret Resolution Engine', () => {
    describe('ENV Resolution', () => {
        beforeEach(() => {
            process.env.__TEST_SECRET_A = 'value-a';
            process.env.__TEST_SECRET_B = 'value-b';
        });

        it('resolves env refs from process.env', async () => {
            const refs: SecretRef[] = [
                { source: 'env', provider: 'env', id: '__TEST_SECRET_A' },
                { source: 'env', provider: 'env', id: '__TEST_SECRET_B' },
            ];
            const config = {};
            const result = await resolveSecretRefs(refs, { config });
            expect(result.get('env:env:__TEST_SECRET_A')).toBe('value-a');
            expect(result.get('env:env:__TEST_SECRET_B')).toBe('value-b');
        });

        it('throws for missing env vars', async () => {
            const refs: SecretRef[] = [{ source: 'env', provider: 'env', id: '__NONEXISTENT_VAR' }];
            await expect(resolveSecretRefs(refs, { config: {} })).rejects.toThrow();
        });

        it('respects env allowlist', async () => {
            const refs: SecretRef[] = [{ source: 'env', provider: 'default', id: '__TEST_SECRET_A' }];
            const config = {
                secrets: {
                    providers: {
                        default: { source: 'env', allowlist: ['OTHER_VAR'] },
                    },
                },
            };
            await expect(resolveSecretRefs(refs, { config })).rejects.toThrow(/allowlist/);
        });

        it('allows if env var is in allowlist', async () => {
            const refs: SecretRef[] = [{ source: 'env', provider: 'default', id: '__TEST_SECRET_A' }];
            const config = {
                secrets: {
                    providers: {
                        default: { source: 'env', allowlist: ['__TEST_SECRET_A'] },
                    },
                },
            };
            const result = await resolveSecretRefs(refs, { config });
            expect(result.get('env:default:__TEST_SECRET_A')).toBe('value-a');
        });

        it('uses custom env', async () => {
            const refs: SecretRef[] = [{ source: 'env', provider: 'env', id: 'CUSTOM_VAR' }];
            const customEnv = { CUSTOM_VAR: 'custom-value' };
            const result = await resolveSecretRefs(refs, { config: {}, env: customEnv as NodeJS.ProcessEnv });
            expect(result.get('env:env:CUSTOM_VAR')).toBe('custom-value');
        });

        it('returns empty map for empty refs', async () => {
            const result = await resolveSecretRefs([], { config: {} });
            expect(result.size).toBe(0);
        });
    });

    describe('Provider Resolution', () => {
        it('throws for unconfigured provider', async () => {
            const refs: SecretRef[] = [{ source: 'file', provider: 'missing', id: 'key' }];
            await expect(resolveSecretRefs(refs, { config: {} })).rejects.toThrow(/not configured/);
        });

        it('throws for source mismatch', async () => {
            const refs: SecretRef[] = [{ source: 'env', provider: 'fileprov', id: 'key' }];
            const config = { secrets: { providers: { fileprov: { source: 'file', path: '/tmp/x' } } } };
            await expect(resolveSecretRefs(refs, { config })).rejects.toThrow(/source/);
        });
    });

    describe('Error Types', () => {
        it('SecretProviderResolutionError has correct shape', () => {
            const err = new SecretProviderResolutionError({ source: 'env', provider: 'default', message: 'test error' });
            expect(err.name).toBe('SecretProviderResolutionError');
            expect(err.scope).toBe('provider');
            expect(err.source).toBe('env');
            expect(err.provider).toBe('default');
            expect(err.message).toBe('test error');
        });

        it('SecretRefResolutionError has correct shape', () => {
            const err = new SecretRefResolutionError({ source: 'file', provider: 'vault', refId: 'key1', message: 'missing' });
            expect(err.name).toBe('SecretRefResolutionError');
            expect(err.scope).toBe('ref');
            expect(err.refId).toBe('key1');
        });
    });
});
