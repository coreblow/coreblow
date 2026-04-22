/**
 * CoreBlow — Config Env Map Tests
 *
 * Tests for env→config path mapping, lookup, sensitive
 * var listing, and env discovery.
 */

import { describe, it, expect } from 'vitest';
import {
    getEnvConfigMap,
    resolveConfigPathForEnv,
    resolveEnvForConfigPath,
    listSensitiveEnvVars,
    discoverSetEnvVars,
} from './config-env-map.js';

describe('getEnvConfigMap', () => {
    it('returns a non-empty array', () => {
        const map = getEnvConfigMap();
        expect(map.length).toBeGreaterThan(10);
    });

    it('all entries have required fields', () => {
        for (const entry of getEnvConfigMap()) {
            expect(entry.envVar).toBeTruthy();
            expect(entry.configPath).toBeTruthy();
            expect(entry.description).toBeTruthy();
            expect(typeof entry.sensitive).toBe('boolean');
        }
    });

    it('contains known env vars', () => {
        const vars = getEnvConfigMap().map(e => e.envVar);
        expect(vars).toContain('OPENAI_API_KEY');
        expect(vars).toContain('COREBLOW_PORT');
        expect(vars).toContain('DISCORD_TOKEN');
    });
});

describe('resolveConfigPathForEnv', () => {
    it('resolves known env var', () => {
        expect(resolveConfigPathForEnv('OPENAI_API_KEY')).toBe('models.openai.apiKey');
        expect(resolveConfigPathForEnv('COREBLOW_PORT')).toBe('gateway.port');
    });

    it('returns undefined for unknown', () => {
        expect(resolveConfigPathForEnv('TOTALLY_UNKNOWN_VAR')).toBeUndefined();
    });
});

describe('resolveEnvForConfigPath', () => {
    it('resolves known config path', () => {
        expect(resolveEnvForConfigPath('models.openai.apiKey')).toBe('OPENAI_API_KEY');
        expect(resolveEnvForConfigPath('gateway.port')).toBe('COREBLOW_PORT');
    });

    it('returns undefined for unknown path', () => {
        expect(resolveEnvForConfigPath('x.y.z')).toBeUndefined();
    });
});

describe('listSensitiveEnvVars', () => {
    it('includes API keys', () => {
        const sensitive = listSensitiveEnvVars();
        expect(sensitive).toContain('OPENAI_API_KEY');
        expect(sensitive).toContain('ANTHROPIC_API_KEY');
        expect(sensitive).toContain('COREBLOW_TOKEN');
    });

    it('excludes non-sensitive vars', () => {
        const sensitive = listSensitiveEnvVars();
        expect(sensitive).not.toContain('COREBLOW_PORT');
        expect(sensitive).not.toContain('LOG_LEVEL');
    });
});

describe('discoverSetEnvVars', () => {
    it('returns entries for set env vars', () => {
        const mockEnv = { OPENAI_API_KEY: 'sk-test', COREBLOW_PORT: '3000' } as NodeJS.ProcessEnv;
        const found = discoverSetEnvVars(mockEnv);
        expect(found).toHaveLength(2);
        expect(found.map(e => e.envVar)).toContain('OPENAI_API_KEY');
    });

    it('returns empty for no matches', () => {
        expect(discoverSetEnvVars({} as NodeJS.ProcessEnv)).toHaveLength(0);
    });
});
