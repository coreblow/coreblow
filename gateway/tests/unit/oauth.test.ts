/**
 * tests/unit/oauth.test.ts
 * Tests for OAuth2 + encryption
 */
import { describe, it, expect } from 'vitest';
import { generatePKCE, buildAuthUrl, encryptToken, decryptToken, needsRefresh, type OAuthTokens } from '../../src/security/oauth.js';

describe('PKCE', () => {
    it('should generate verifier and challenge', () => {
        const { verifier, challenge } = generatePKCE();
        expect(verifier.length).toBeGreaterThan(20);
        expect(challenge.length).toBeGreaterThan(20);
        expect(verifier).not.toBe(challenge);
    });
});

describe('buildAuthUrl', () => {
    it('should build authorization URL', () => {
        const { url, state } = buildAuthUrl({
            clientId: 'test-client',
            authorizeUrl: 'https://auth.example.com/authorize',
            tokenUrl: 'https://auth.example.com/token',
            redirectUri: 'http://localhost:3000/callback',
            scopes: ['read', 'write'],
        });
        expect(url).toContain('https://auth.example.com/authorize');
        expect(url).toContain('client_id=test-client');
        expect(url).toContain('scope=read+write');
        expect(state.length).toBeGreaterThan(0);
    });

    it('should include PKCE challenge when enabled', () => {
        const { url, pkce } = buildAuthUrl({
            clientId: 'test',
            authorizeUrl: 'https://auth.example.com/authorize',
            tokenUrl: 'https://auth.example.com/token',
            redirectUri: 'http://localhost:3000/callback',
            scopes: ['read'],
            usePKCE: true,
        });
        expect(url).toContain('code_challenge=');
        expect(url).toContain('code_challenge_method=S256');
        expect(pkce).toBeTruthy();
    });
});

describe('Token Encryption', () => {
    it('should encrypt and decrypt a token', () => {
        const secret = 'my-secret-key-12345';
        const original = 'sk-super-secret-api-key-12345';
        const encrypted = encryptToken(original, secret);
        expect(encrypted).not.toBe(original);
        expect(encrypted).toContain(':');

        const decrypted = decryptToken(encrypted, secret);
        expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
        const secret = 'key';
        const token = 'same-token';
        const e1 = encryptToken(token, secret);
        const e2 = encryptToken(token, secret);
        expect(e1).not.toBe(e2); // Different IVs
    });

    it('should fail with wrong secret', () => {
        const encrypted = encryptToken('token', 'secret1');
        expect(() => decryptToken(encrypted, 'wrong-secret')).toThrow();
    });
});

describe('needsRefresh', () => {
    it('should return true for expired tokens', () => {
        const tokens: OAuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() - 1000,
            tokenType: 'Bearer',
        };
        expect(needsRefresh(tokens)).toBe(true);
    });

    it('should return true for tokens expiring within 5 minutes', () => {
        const tokens: OAuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() + 2 * 60 * 1000, // 2 min left
            tokenType: 'Bearer',
        };
        expect(needsRefresh(tokens)).toBe(true);
    });

    it('should return false for fresh tokens', () => {
        const tokens: OAuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour left
            tokenType: 'Bearer',
        };
        expect(needsRefresh(tokens)).toBe(false);
    });
});
