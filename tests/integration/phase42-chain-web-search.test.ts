/**
 * CoreBlow Phase 42 — Web Search Credential Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Credential Checks → Provider Validation → Mock Request
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasProviderCredential } from '../../src/web-search/credential-resolver.js';

describe('Phase42 Chain: Web Search Credentials', () => {
    const originalEnv = process.env;

    beforeEach(() => { process.env = { ...originalEnv }; });
    afterEach(() => { process.env = originalEnv; });

    it('should validate provider readiness through config and env hierarchy', () => {
        // Step 1: Simulated search provider definition
        const providerDef = {
            id: 'google-custom',
            requiresCredential: true,
            envVars: ['GOOGLE_SEARCH_KEY'],
            getCredentialValue: (cfg: any) => cfg?.googleKey,
        };

        // Step 2: Test empty state (Not ready)
        expect(hasProviderCredential(providerDef, {}, {})).toBe(false);

        // Step 3: Add to searchConfig (Ready)
        expect(hasProviderCredential(providerDef, {}, { googleKey: 'conf-secret' })).toBe(true);

        // Step 4: Add to ENV vars instead (Ready)
        process.env['GOOGLE_SEARCH_KEY'] = 'env-secret';
        expect(hasProviderCredential(providerDef, {}, {})).toBe(true);
    });
});
