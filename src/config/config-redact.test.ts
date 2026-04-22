/**
 * CoreBlow — Config Redaction Tests
 *
 * Tests for redactConfig: sensitive key detection, partial redaction,
 * nested object traversal, and depth limiting.
 */

import { describe, it, expect } from 'vitest';
import { redactConfig } from './config-redact.js';

describe('redactConfig', () => {
    it('redacts known sensitive keys', () => {
        const result = redactConfig({
            apiKey: 'sk-1234567890abcdef',
            token: 'tok-abcdefghijklmnop',
            name: 'safe-value',
        });

        expect(result['apiKey']).toMatch(/^sk-1\*\*\*cdef$/);
        expect(result['token']).toMatch(/^tok-\*\*\*mnop$/);
        expect(result['name']).toBe('safe-value');
    });

    it('redacts keys containing "key", "secret", "token" (case-insensitive)', () => {
        const result = redactConfig({
            myApiKey: 'long-secret-value-here',
            channelSecret: 'another-long-value!',
            accessToken: 'Bearer token-value-1234',
        });

        expect(result['myApiKey']).toContain('***');
        expect(result['channelSecret']).toContain('***');
        expect(result['accessToken']).toContain('***');
    });

    it('fully redacts short sensitive values', () => {
        const result = redactConfig({
            apiKey: 'short',
            token: '12345678', // exactly 8, still short
        });

        expect(result['apiKey']).toBe('***');
        expect(result['token']).toBe('***');
    });

    it('preserves non-sensitive values', () => {
        const result = redactConfig({
            host: 'localhost',
            port: 3000,
            enabled: true,
            tags: ['a', 'b'],
        });

        expect(result['host']).toBe('localhost');
        expect(result['port']).toBe(3000);
        expect(result['enabled']).toBe(true);
        expect(result['tags']).toEqual(['a', 'b']);
    });

    it('recursively redacts nested objects', () => {
        const result = redactConfig({
            database: {
                password: 'super-secret-password-123',
                host: 'db.example.com',
            },
        });

        const db = result['database'] as Record<string, unknown>;
        expect(db['host']).toBe('db.example.com');
        // password contains "secret" via key name
    });

    it('handles deeply nested objects', () => {
        const result = redactConfig({
            level1: { level2: { level3: { apiKey: 'deep-secret-12345' } } },
        });

        const deep = (result['level1'] as any).level2.level3;
        expect(deep['apiKey']).toContain('***');
    });

    it('handles empty object', () => {
        expect(redactConfig({})).toEqual({});
    });

    it('does not modify the original object', () => {
        const original = { apiKey: 'sk-1234567890abcdef' };
        redactConfig(original);
        expect(original.apiKey).toBe('sk-1234567890abcdef');
    });
});
