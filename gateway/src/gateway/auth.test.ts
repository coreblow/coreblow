/**
 * gateway/auth.test.ts — Gateway auth tests (updated for expanded API)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticate, clearRateLimits, type AuthConfig } from './auth.js';

describe('Gateway Auth', () => {
    beforeEach(() => clearRateLimits());

    const config: AuthConfig = {
        strategies: ['api-key'],
        apiKeys: [{ key: 'valid-token', role: 'owner', label: 'admin' }],
    };

    it('should authenticate valid token', () => {
        const result = authenticate({ headers: { 'x-api-key': 'valid-token' } }, config);
        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('admin');
    });

    it('should reject invalid token', () => {
        const result = authenticate({ headers: { 'x-api-key': 'bad-token' } }, config);
        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('invalid_api_key');
    });

    it('should reject empty token', () => {
        const result = authenticate({ headers: {} }, config);
        expect(result.authenticated).toBe(false);
    });
});
