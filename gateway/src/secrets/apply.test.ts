/**
 * secrets/apply.test.ts — Config secret application tests
 */
import { describe, it, expect } from 'vitest';
import { applyResolvedSecrets, redactSecretsFromConfig } from './apply.js';

describe('Secret Application', () => {
    it('applies resolved secrets to config', () => {
        const config = {
            channels: { discord: { token: 'secret:env:default:DISCORD_TOKEN' } },
            models: { openai: { apiKey: 'secret:env:default:OPENAI_API_KEY' } },
        };
        const resolved = new Map([
            ['env:default:DISCORD_TOKEN', 'real-discord-token'],
            ['env:default:OPENAI_API_KEY', 'sk-real-key'],
        ]);

        const result = applyResolvedSecrets(config, resolved);
        expect(result.applied).toBe(2);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(config.channels.discord.token).toBe('real-discord-token');
        expect(config.models.openai.apiKey).toBe('sk-real-key');
    });

    it('tracks unresolved refs as errors', () => {
        const config = { key: 'secret:env:default:MISSING_VAR' };
        const resolved = new Map<string, unknown>();
        const result = applyResolvedSecrets(config, resolved);
        expect(result.applied).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toBe('key');
    });

    it('skips non-secret strings', () => {
        const config = { name: 'my-bot', version: '1.0' };
        const result = applyResolvedSecrets(config, new Map());
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(0);
    });

    it('handles nested objects', () => {
        const config = { a: { b: { c: 'secret:env:default:KEY' } } };
        const resolved = new Map([['env:default:KEY', 'value']]);
        const result = applyResolvedSecrets(config, resolved);
        expect(result.applied).toBe(1);
        expect((config.a.b as Record<string, unknown>).c).toBe('value');
    });

    it('handles arrays', () => {
        const config = { list: ['secret:env:default:A', 'plain', 'secret:env:default:B'] };
        const resolved = new Map([['env:default:A', 'val-a'], ['env:default:B', 'val-b']]);
        const result = applyResolvedSecrets(config, resolved);
        expect(result.applied).toBe(2);
        expect(config.list[0]).toBe('val-a');
        expect(config.list[1]).toBe('plain');
        expect(config.list[2]).toBe('val-b');
    });
});

describe('Config Redaction', () => {
    it('redacts secret ref strings', () => {
        const config = { token: 'secret:env:default:TOKEN', name: 'bot' };
        const redacted = redactSecretsFromConfig(config);
        expect(redacted.token).toBe('[REDACTED]');
        expect(redacted.name).toBe('bot');
    });

    it('redacts sensitive field names', () => {
        const config = { apiKey: 'sk-1234567890', name: 'my-app' };
        const redacted = redactSecretsFromConfig(config);
        expect(redacted.apiKey).toBe('[REDACTED]');
        expect(redacted.name).toBe('my-app');
    });

    it('handles nested objects', () => {
        const config = { channels: { discord: { token: 'real-token' } } };
        const redacted = redactSecretsFromConfig(config);
        expect((redacted.channels as Record<string, unknown>).discord).toEqual({ token: '[REDACTED]' });
    });
});
