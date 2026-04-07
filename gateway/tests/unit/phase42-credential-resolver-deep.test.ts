/**
 * CoreBlow Phase 42 — Credential Resolver Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - normalizeSecretInput, readProviderEnvValue, hasProviderCredential
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeSecretInput, readProviderEnvValue, providerRequiresCredential, hasProviderCredential } from '../../src/web-search/credential-resolver.js';

describe('CredentialResolver — Extended', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('normalizeSecretInput should trim strings and return undefined for empty', () => {
        expect(normalizeSecretInput('  secret  ')).toBe('secret');
        expect(normalizeSecretInput('   ')).toBeUndefined();
        expect(normalizeSecretInput(null)).toBeUndefined();
        expect(normalizeSecretInput(123)).toBeUndefined();
    });

    it('readProviderEnvValue should read first valid env var', () => {
        process.env['TEST_1'] = '  ';
        process.env['TEST_2'] = 'value2';
        
        expect(readProviderEnvValue(['TEST_1', 'TEST_2'])).toBe('value2');
        expect(readProviderEnvValue(['UNKNOWN'])).toBeUndefined();
    });

    it('providerRequiresCredential checks flag', () => {
        expect(providerRequiresCredential({ requiresCredential: false })).toBe(false);
        expect(providerRequiresCredential({ requiresCredential: true })).toBe(true);
        expect(providerRequiresCredential({})).toBe(true); // default true
    });

    it('hasProviderCredential when not required', () => {
        expect(hasProviderCredential({ requiresCredential: false } as any, {}, {})).toBe(true);
    });

    it('hasProviderCredential from config', () => {
        const provider = {
            requiresCredential: true,
            envVars: [],
            getCredentialValue: (cfg: any) => cfg?.key,
        };
        expect(hasProviderCredential(provider as any, undefined, { key: 'secret' })).toBe(true);
        expect(hasProviderCredential(provider as any, undefined, { key: '   ' })).toBe(false);
    });

    it('hasProviderCredential from env vars', () => {
        process.env['API_KEY'] = 'secret';
        const provider = {
            requiresCredential: true,
            envVars: ['API_KEY'],
            getCredentialValue: () => undefined,
        };
        expect(hasProviderCredential(provider as any, undefined, undefined)).toBe(true);
    });
});
