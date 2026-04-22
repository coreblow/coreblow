/**
 * CoreBlow — Payload Redaction Tests (Inline)
 *
 * Tests for isCredentialFieldName and NON_CREDENTIAL_FIELD_NAMES logic.
 * Inline to avoid media/base64 import chain.
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas of pure inner functions ────────────────────────

const NON_CREDENTIAL_FIELD_NAMES = new Set([
    'passwordfile', 'tokenbudget', 'tokencount',
    'tokenfield', 'tokenlimit', 'tokens',
]);

function normalizeFieldName(value: string): string {
    return value.replaceAll(/[^a-z0-9]/gi, '').toLowerCase();
}

function isCredentialFieldName(key: string): boolean {
    const normalized = normalizeFieldName(key);
    if (!normalized || NON_CREDENTIAL_FIELD_NAMES.has(normalized)) return false;
    if (normalized === 'authorization' || normalized === 'proxyauthorization') return true;
    return (
        normalized.endsWith('apikey') ||
        normalized.endsWith('password') ||
        normalized.endsWith('passwd') ||
        normalized.endsWith('passphrase') ||
        normalized.endsWith('secret') ||
        normalized.endsWith('secretkey') ||
        normalized.endsWith('token')
    );
}

describe('isCredentialFieldName', () => {
    it('detects API key fields', () => {
        expect(isCredentialFieldName('api_key')).toBe(true);
        expect(isCredentialFieldName('API_KEY')).toBe(true);
        expect(isCredentialFieldName('openai-api-key')).toBe(true);
        expect(isCredentialFieldName('ANTHROPIC_API_KEY')).toBe(true);
    });

    it('detects password fields', () => {
        expect(isCredentialFieldName('password')).toBe(true);
        expect(isCredentialFieldName('db_password')).toBe(true);
        expect(isCredentialFieldName('user-passwd')).toBe(true);
    });

    it('detects secret fields', () => {
        expect(isCredentialFieldName('client_secret')).toBe(true);
        expect(isCredentialFieldName('SECRET_KEY')).toBe(true);
        expect(isCredentialFieldName('webhook-secret')).toBe(true);
    });

    it('detects token fields', () => {
        expect(isCredentialFieldName('access_token')).toBe(true);
        expect(isCredentialFieldName('bearer-token')).toBe(true);
        expect(isCredentialFieldName('OAUTH_TOKEN')).toBe(true);
    });

    it('detects authorization headers', () => {
        expect(isCredentialFieldName('authorization')).toBe(true);
        expect(isCredentialFieldName('proxy-authorization')).toBe(true);
    });

    it('detects passphrase fields', () => {
        expect(isCredentialFieldName('ssh_passphrase')).toBe(true);
    });

    it('rejects non-credential fields', () => {
        expect(isCredentialFieldName('username')).toBe(false);
        expect(isCredentialFieldName('email')).toBe(false);
        expect(isCredentialFieldName('name')).toBe(false);
        expect(isCredentialFieldName('model')).toBe(false);
        expect(isCredentialFieldName('host')).toBe(false);
    });

    it('rejects NON_CREDENTIAL exceptions', () => {
        expect(isCredentialFieldName('tokenBudget')).toBe(false);
        expect(isCredentialFieldName('token_count')).toBe(false);
        expect(isCredentialFieldName('token_limit')).toBe(false);
        expect(isCredentialFieldName('tokens')).toBe(false);
        expect(isCredentialFieldName('password_file')).toBe(false);
    });

    it('handles empty string', () => {
        expect(isCredentialFieldName('')).toBe(false);
    });
});
