import { describe, it, expect } from 'vitest';
import { generatePKCE, buildAuthUrl, encryptToken, decryptToken, needsRefresh } from './oauth.js';
import type { OAuthTokens } from './oauth.js';

describe('generatePKCE', () => {
    it('should generate verifier and challenge', () => {
        const pkce = generatePKCE();
        expect(pkce.verifier).toBeDefined();
        expect(pkce.challenge).toBeDefined();
        expect(pkce.verifier.length).toBeGreaterThan(0);
        expect(pkce.challenge.length).toBeGreaterThan(0);
    });

    it('should generate different verifiers each call', () => {
        const a = generatePKCE();
        const b = generatePKCE();
        expect(a.verifier).not.toBe(b.verifier);
    });

    it('challenge should differ from verifier', () => {
        const pkce = generatePKCE();
        expect(pkce.challenge).not.toBe(pkce.verifier);
    });
});

describe('buildAuthUrl', () => {
    it('should build a proper OAuth URL', () => {
        const url = buildAuthUrl(
            'https://auth.example.com/authorize',
            'my-client-id',
            'https://app.example.com/callback',
            'openid profile',
            'abc123challenge',
        );
        expect(url).toContain('https://auth.example.com/authorize?');
        expect(url).toContain('client_id=my-client-id');
        expect(url).toContain('redirect_uri=');
        expect(url).toContain('scope=openid profile');
        expect(url).toContain('code_challenge=abc123challenge');
        expect(url).toContain('response_type=code');
    });

    it('should URL-encode the redirect_uri', () => {
        const url = buildAuthUrl('https://auth.example.com', 'cid', 'https://app.com/cb?x=1', 'scope', 'ch');
        expect(url).toContain(encodeURIComponent('https://app.com/cb?x=1'));
    });
});

describe('encryptToken / decryptToken', () => {
    it('should encrypt and decrypt a token', () => {
        const key = 'my-secret-encryption-key-here!!';
        const token = 'eyJhbGciOiJIUzI1NiJ9.test-token';
        const encrypted = encryptToken(token, key);
        expect(encrypted).not.toBe(token);
        expect(encrypted).toContain(':');
        const decrypted = decryptToken(encrypted, key);
        expect(decrypted).toBe(token);
    });

    it('should produce different ciphertexts for same token (random IV)', () => {
        const key = 'encryption-key-for-testing!!!!!';
        const token = 'same-token';
        const a = encryptToken(token, key);
        const b = encryptToken(token, key);
        expect(a).not.toBe(b); // Different IVs
    });

    it('should handle empty token', () => {
        const key = 'key-for-empty-token-test!!!!!';
        const encrypted = encryptToken('', key);
        expect(decryptToken(encrypted, key)).toBe('');
    });

    it('should handle short key (pads to 32)', () => {
        const key = 'short';
        const token = 'test';
        const encrypted = encryptToken(token, key);
        expect(decryptToken(encrypted, key)).toBe(token);
    });
});

describe('needsRefresh', () => {
    it('should return false if no expiresAt', () => {
        const tokens: OAuthTokens = { accessToken: 'abc' };
        expect(needsRefresh(tokens)).toBe(false);
    });

    it('should return false if token not near expiry', () => {
        const tokens: OAuthTokens = { accessToken: 'abc', expiresAt: Date.now() + 600_000 };
        expect(needsRefresh(tokens)).toBe(false);
    });

    it('should return true if token expires within 5 minutes', () => {
        const tokens: OAuthTokens = { accessToken: 'abc', expiresAt: Date.now() + 200_000 };
        expect(needsRefresh(tokens)).toBe(true);
    });

    it('should return true if token already expired', () => {
        const tokens: OAuthTokens = { accessToken: 'abc', expiresAt: Date.now() - 1000 };
        expect(needsRefresh(tokens)).toBe(true);
    });
});
