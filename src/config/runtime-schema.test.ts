import { describe, it, expect } from 'vitest';
import { validateRuntimeConfig, hasBlockingErrors, formatValidationIssues } from './runtime-schema.js';

describe('Runtime Schema Validation', () => {
    it('accepts valid config', () => {
        const issues = validateRuntimeConfig({
            gateway: { port: 3000, host: '127.0.0.1' },
        });
        expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('rejects invalid port', () => {
        const issues = validateRuntimeConfig({ gateway: { port: 99999 } });
        expect(issues.some((i) => i.path === 'gateway.port' && i.severity === 'error')).toBe(true);
    });

    it('warns on non-loopback host', () => {
        const issues = validateRuntimeConfig({ gateway: { host: '10.0.0.1' } });
        expect(issues.some((i) => i.path === 'gateway.host' && i.severity === 'warning')).toBe(true);
    });

    it('rejects invalid autoReplyMode', () => {
        const issues = validateRuntimeConfig({ agents: { defaults: { autoReplyMode: 'invalid' } } });
        expect(issues.some((i) => i.path.includes('autoReplyMode'))).toBe(true);
    });

    it('rejects invalid sandbox mode', () => {
        const issues = validateRuntimeConfig({ agents: { defaults: { sandbox: { mode: 'bad' } } } });
        expect(issues.some((i) => i.path.includes('sandbox.mode'))).toBe(true);
    });

    it('warns on unknown channel', () => {
        const issues = validateRuntimeConfig({ channels: { myCustomChannel: {} } });
        expect(issues.some((i) => i.path === 'channels.myCustomChannel')).toBe(true);
    });

    it('errors on missing discord token', () => {
        const origToken = process.env.DISCORD_TOKEN;
        delete process.env.DISCORD_TOKEN;
        const issues = validateRuntimeConfig({ channels: { discord: {} } });
        expect(issues.some((i) => i.path === 'channels.discord.token')).toBe(true);
        if (origToken) process.env.DISCORD_TOKEN = origToken;
    });

    it('rejects invalid log level', () => {
        const issues = validateRuntimeConfig({ logging: { level: 'verbose' } });
        expect(issues.some((i) => i.path === 'logging.level')).toBe(true);
    });

    it('empty config passes without errors', () => {
        const issues = validateRuntimeConfig({});
        expect(hasBlockingErrors(issues)).toBe(false);
    });

    it('formatValidationIssues works', () => {
        const issues = validateRuntimeConfig({ gateway: { port: -1 } });
        const formatted = formatValidationIssues(issues);
        expect(formatted).toContain('❌');
    });

    it('formatValidationIssues shows pass for empty issues', () => {
        expect(formatValidationIssues([])).toContain('✅');
    });
});
