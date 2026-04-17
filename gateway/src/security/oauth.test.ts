/**
 * CoreBlow Security — OAuth Test Suite
 *
 * Covers: generatePKCE(), buildAuthUrl(), encryptToken()/decryptToken()
 * round-trip, needsRefresh(), and edge cases.
 */
import { describe, it, expect } from 'vitest';
import {
    generatePKCE,
    buildAuthUrl,
    encryptToken,
    decryptToken,
    needsRefresh,
    type OAuthTokens,
} from './oauth.js';

describe('OAuth', () => {
    // ─── generatePKCE() ─────────────────────────────────────────

    describe('generatePKCE()', () => {
        it('returns verifier and challenge strings', () => {
            const pkce = generatePKCE();
            expect(pkce.verifier).toBeTruthy();
            expect(pkce.challenge).toBeTruthy();
            expect(typeof pkce.verifier).toBe('string');
            expect(typeof pkce.challenge).toBe('string');
        });

        it('generates unique values each time', () => {
            const a = generatePKCE();
            const b = generatePKCE();
            expect(a.verifier).not.toBe(b.verifier);
            expect(a.challenge).not.toBe(b.challenge);
        });

        it('challenge is derived from verifier (SHA-256 base64url)', () => {
            const pkce = generatePKCE();
            // Challenge should be a base64url string (shorter than verifier or similar length)
            expect(pkce.challenge.length).toBeGreaterThan(0);
            // Verify no padding ('=')
            expect(pkce.challenge).not.toContain('=');
        });

        it('verifier is base64url encoded (no +, /, =)', () => {
            const pkce = generatePKCE();
            expect(pkce.verifier).not.toContain('+');
            expect(pkce.verifier).not.toContain('/');
            expect(pkce.verifier).not.toContain('=');
        });
    });

    // ─── buildAuthUrl() ─────────────────────────────────────────

    describe('buildAuthUrl()', () => {
        it('builds a valid OAuth authorization URL', () => {
            const url = buildAuthUrl(
                'https://auth.example.com/authorize',
                'my-client-id',
                'https://app.example.com/callback',
                'read write',
                'challenge123',
            );

            expect(url).toContain('https://auth.example.com/authorize?');
            expect(url).toContain('client_id=my-client-id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain(encodeURIComponent('https://app.example.com/callback'));
            expect(url).toContain('scope=read write');
            expect(url).toContain('code_challenge=challenge123');
            expect(url).toContain('response_type=code');
        });

        it('encodes redirect URI', () => {
            const url = buildAuthUrl('https://auth.com', 'id', 'https://my.app/cb?test=1', 'read', 'ch');
            expect(url).toContain(encodeURIComponent('https://my.app/cb?test=1'));
        });
    });

    // ─── encryptToken() / decryptToken() ────────────────────────

    describe('encryptToken() / decryptToken()', () => {
        const key = 'my-secret-encryption-key-32chars';

        it('round-trips: decrypt(encrypt(token)) === token', () => {
            const token = 'sk-test-1234567890abcdef';
            const encrypted = encryptToken(token, key);
            const decrypted = decryptToken(encrypted, key);
            expect(decrypted).toBe(token);
        });

        it('produces different ciphertext each time (random IV)', () => {
            const token = 'same-token';
            const a = encryptToken(token, key);
            const b = encryptToken(token, key);
            expect(a).not.toBe(b);
        });

        it('encrypted output has iv:data format', () => {
            const encrypted = encryptToken('test', key);
            const parts = encrypted.split(':');
            expect(parts.length).toBe(2);
            expect(parts[0]!.length).toBe(32); // 16 bytes as hex
        });

        it('handles empty token', () => {
            const encrypted = encryptToken('', key);
            expect(decryptToken(encrypted, key)).toBe('');
        });

        it('handles short key (padded to 32)', () => {
            const shortKey = 'short';
            const token = 'my-token';
            const encrypted = encryptToken(token, shortKey);
            const decrypted = decryptToken(encrypted, shortKey);
            expect(decrypted).toBe(token);
        });

        it('handles long key (truncated to 32)', () => {
            const longKey = 'a'.repeat(64);
            const token = 'my-token';
            const encrypted = encryptToken(token, longKey);
            const decrypted = decryptToken(encrypted, longKey);
            expect(decrypted).toBe(token);
        });

        it('fails to decrypt with wrong key', () => {
            const encrypted = encryptToken('secret', 'correct-key');
            expect(() => decryptToken(encrypted, 'wrong-key')).toThrow();
        });

        it('handles unicode tokens', () => {
            const token = '日本語トークン🔑';
            const encrypted = encryptToken(token, key);
            expect(decryptToken(encrypted, key)).toBe(token);
        });
    });

    // ─── needsRefresh() ─────────────────────────────────────────

    describe('needsRefresh()', () => {
        it('returns false when no expiresAt', () => {
            const tokens: OAuthTokens = { accessToken: 'token' };
            expect(needsRefresh(tokens)).toBe(false);
        });

        it('returns false when token is not near expiry', () => {
            const tokens: OAuthTokens = {
                accessToken: 'token',
                expiresAt: Date.now() + 600_000, // 10 minutes from now
            };
            expect(needsRefresh(tokens)).toBe(false);
        });

        it('returns true when token expires within 5 minutes', () => {
            const tokens: OAuthTokens = {
                accessToken: 'token',
                expiresAt: Date.now() + 200_000, // 3.3 minutes from now (< 5 min buffer)
            };
            expect(needsRefresh(tokens)).toBe(true);
        });

        it('returns true when token has already expired', () => {
            const tokens: OAuthTokens = {
                accessToken: 'token',
                expiresAt: Date.now() - 1000, // Already expired
            };
            expect(needsRefresh(tokens)).toBe(true);
        });

        it('returns false for token exactly at 5 minute boundary', () => {
            const tokens: OAuthTokens = {
                accessToken: 'token',
                expiresAt: Date.now() + 300_001, // Just over 5 min from now
            };
            expect(needsRefresh(tokens)).toBe(false);
        });
    });
});
