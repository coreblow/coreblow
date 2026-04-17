/**
 * config/config.schema.test.ts
 * Tests for Zod config schema validation.
 */
import { describe, it, expect } from 'vitest';
import {
    CoreBlowConfigSchema,
    validateConfig,
    safeValidateConfig,
    mergeWithDefaults,
} from './config.schema.js';

describe('CoreBlowConfigSchema', () => {
    it('should accept empty object and apply all defaults', () => {
        const config = validateConfig({});
        expect(config.version).toBe('1.0');
        expect(config.gateway.port).toBe(3577);
        expect(config.gateway.host).toBe('127.0.0.1');
        expect(config.agents.defaults.temperature).toBe(0.7);
        expect(config.agents.defaults.maxTokens).toBe(8192);
        expect(config.sandbox.mode).toBe('off');
        expect(config.tools.profile).toBe('coding');
        expect(config.logging.level).toBe('info');
        expect(config.features.dashboard).toBe(true);
    });

    it('should override defaults with provided values', () => {
        const config = validateConfig({
            gateway: { port: 9999, host: '0.0.0.0' },
            agents: { defaults: { temperature: 0.1 } },
        });
        expect(config.gateway.port).toBe(9999);
        expect(config.gateway.host).toBe('0.0.0.0');
        expect(config.agents.defaults.temperature).toBe(0.1);
        // Other defaults should still apply
        expect(config.agents.defaults.maxTokens).toBe(8192);
    });

    it('should reject invalid port numbers', () => {
        const result = safeValidateConfig({ gateway: { port: 99999 } });
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.some(e => e.includes('port'))).toBe(true);
    });

    it('should reject negative port', () => {
        const result = safeValidateConfig({ gateway: { port: -1 } });
        expect(result.success).toBe(false);
    });

    it('should reject temperature out of range', () => {
        const result = safeValidateConfig({ agents: { defaults: { temperature: 5 } } });
        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.includes('temperature'))).toBe(true);
    });

    it('should accept valid tool profiles', () => {
        const config = validateConfig({ tools: { profile: 'full' } });
        expect(config.tools.profile).toBe('full');
    });

    it('should reject invalid tool profiles', () => {
        const result = safeValidateConfig({ tools: { profile: 'bogus' } });
        expect(result.success).toBe(false);
    });

    it('should accept sandbox config', () => {
        const config = validateConfig({
            sandbox: { mode: 'container', cpus: 4, memoryMb: 4096 },
        });
        expect(config.sandbox.mode).toBe('container');
        expect(config.sandbox.cpus).toBe(4);
        expect(config.sandbox.memoryMb).toBe(4096);
    });

    it('should reject invalid sandbox mode', () => {
        const result = safeValidateConfig({ sandbox: { mode: 'magic' } });
        expect(result.success).toBe(false);
    });

    it('should accept channel configs with passthrough', () => {
        const config = validateConfig({
            channels: {
                discord: { enabled: true, token: 'xxx' },
                telegram: { enabled: false },
            },
        });
        expect(config.channels!['discord'].enabled).toBe(true);
        expect(config.channels!['telegram'].enabled).toBe(false);
    });

    it('should accept model aliases', () => {
        const config = validateConfig({
            models: {
                default: 'openai/gpt-4o',
                aliases: { fast: 'openai/gpt-4o-mini' },
            },
        });
        expect(config.models.default).toBe('openai/gpt-4o');
        expect(config.models.aliases['fast']).toBe('openai/gpt-4o-mini');
    });

    it('should accept logging config', () => {
        const config = validateConfig({ logging: { level: 'debug', format: 'json' } });
        expect(config.logging.level).toBe('debug');
        expect(config.logging.format).toBe('json');
    });

    it('should reject invalid logging level', () => {
        const result = safeValidateConfig({ logging: { level: 'verbose' } });
        expect(result.success).toBe(false);
    });

    it('mergeWithDefaults returns complete config', () => {
        const config = mergeWithDefaults({ gateway: { port: 8080 } });
        expect(config.gateway.port).toBe(8080);
        expect(config.gateway.host).toBe('127.0.0.1');
        expect(config.version).toBe('1.0');
    });

    it('should accept features config', () => {
        const config = validateConfig({ features: { dashboard: false, webSearch: true } });
        expect(config.features.dashboard).toBe(false);
        expect(config.features.webSearch).toBe(true);
        expect(config.features.cron).toBe(true); // default
    });

    it('should accept agent list', () => {
        const config = validateConfig({
            agents: {
                list: [
                    { id: 'a1', name: 'Agent 1' },
                    { id: 'a2', name: 'Agent 2', tools: { profile: 'minimal' } },
                ],
            },
        });
        expect(config.agents.list).toHaveLength(2);
        expect(config.agents.list![1].tools!.profile).toBe('minimal');
    });

    it('should reject agent with empty id', () => {
        const result = safeValidateConfig({
            agents: { list: [{ id: '', name: 'Bad' }] },
        });
        expect(result.success).toBe(false);
    });

    it('should accept exec config', () => {
        const config = validateConfig({
            tools: {
                exec: {
                    ask: 'always',
                    allowlist: ['ls', 'cat'],
                    denylist: ['rm'],
                },
            },
        });
        expect(config.tools.exec!.ask).toBe('always');
        expect(config.tools.exec!.allowlist).toEqual(['ls', 'cat']);
    });

    it('should accept auth config', () => {
        const config = validateConfig({ gateway: { auth: { token: 'secret123' } } });
        expect(config.gateway.auth!.token).toBe('secret123');
    });
});
