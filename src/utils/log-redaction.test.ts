/**
 * utils/log-redaction.test.ts — Log redaction engine tests
 */
import { describe, it, expect } from 'vitest';
import { redactApiKeys, redactLogObject, containsSecrets } from './log-redaction.js';

describe('Log Redaction', () => {
    describe('redactApiKeys', () => {
        it('redacts OpenAI API key', () => {
            const text = 'Using key sk-1234567890abcdefghijklmnop';
            const redacted = redactApiKeys(text);
            expect(redacted).toContain('[REDACTED]');
            expect(redacted).not.toContain('sk-1234567890');
        });

        it('redacts Anthropic key', () => {
            const text = 'Key: sk-ant-abcdefghijklmnopqrstuvwx';
            expect(redactApiKeys(text)).toContain('[REDACTED]');
        });

        it('redacts GitHub PAT', () => {
            const text = 'Token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            expect(redactApiKeys(text)).toContain('[REDACTED]');
        });

        it('redacts Bearer tokens', () => {
            const text = 'Authorization: Bearer eyABCDEFGHIJKLMNOPQRSTUVWXYZ';
            expect(redactApiKeys(text)).toContain('[REDACTED]');
        });

        it('keeps safe text unchanged', () => {
            const text = 'This is a normal log message with no secrets.';
            expect(redactApiKeys(text)).toBe(text);
        });

        it('redacts multiple patterns', () => {
            const text = 'Key1: sk-abcdefghijklmnopqrstuvwxyz Key2: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            const redacted = redactApiKeys(text);
            expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('redactLogObject', () => {
        it('redacts sensitive fields', () => {
            const obj = { name: 'bot', token: 'my-secret-token', url: 'https://api.example.com' };
            const redacted = redactLogObject(obj);
            expect(redacted.token).toBe('[REDACTED]');
            expect(redacted.name).toBe('bot');
            expect(redacted.url).toBe('https://api.example.com');
        });

        it('redacts nested sensitive fields', () => {
            const obj = { config: { discord: { token: 'discord-token', botName: 'Bot' } } };
            const redacted = redactLogObject(obj);
            const config = redacted.config as Record<string, unknown>;
            const discord = config.discord as Record<string, unknown>;
            expect(discord.token).toBe('[REDACTED]');
            expect(discord.botName).toBe('Bot');
        });

        it('handles arrays', () => {
            const obj = { items: ['safe', 'also-safe'] };
            const redacted = redactLogObject(obj);
            expect(redacted.items).toEqual(['safe', 'also-safe']);
        });

        it('uses custom sensitive keys', () => {
            const obj = { myField: 'value', safe: 'ok' };
            const redacted = redactLogObject(obj, ['myField']);
            expect(redacted.myField).toBe('[REDACTED]');
            expect(redacted.safe).toBe('ok');
        });
    });

    describe('containsSecrets', () => {
        it('detects OpenAI key', () => {
            expect(containsSecrets('sk-1234567890abcdefghijklmnop')).toBe(true);
        });

        it('detects GitHub PAT', () => {
            expect(containsSecrets('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
        });

        it('returns false for safe text', () => {
            expect(containsSecrets('This is safe text')).toBe(false);
        });
    });
});
