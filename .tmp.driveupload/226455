/**
 * Tests: Config Module — Validator, Dotenv, Watch
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateConfig, mergeConfigs, resolveEnvOverrides } from '../../src/config/validator.js';
import { parseDotenv } from '../../src/config/dotenv.js';
import { watchConfig } from '../../src/config/watch.js';

describe('validateConfig', () => {
    const schema = {
        name: 'test-schema',
        properties: {
            model: { type: 'string' as const, required: true, description: 'Model' },
            port: { type: 'number' as const, required: false, description: 'Port', default: 3000 },
        },
    };

    it('validates required fields', () => {
        const result = validateConfig({}, schema);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('passes valid config', () => {
        const result = validateConfig({ model: 'gpt-4' }, schema);
        expect(result.valid).toBe(true);
    });

    it('applies defaults', () => {
        const result = validateConfig({ model: 'gpt-4' }, schema);
        expect(result.resolved.port).toBe(3000);
    });

    it('rejects wrong type', () => {
        const result = validateConfig(
            { model: 123 },
            { name: 'type-test', properties: { model: { type: 'string' as const, required: true, description: 'M' } } },
        );
        expect(result.valid).toBe(false);
    });
});

describe('mergeConfigs', () => {
    it('merges multiple layers', () => {
        const result = mergeConfigs([
            { source: 'default' as const, data: { a: 1, b: 2 } },
            { source: 'file' as const, data: { b: 3, c: 4 } },
        ]);
        expect(result.a).toBe(1);
        expect(result.b).toBe(3);
        expect(result.c).toBe(4);
    });

    it('handles empty layers', () => {
        expect(mergeConfigs([])).toEqual({});
    });
});

describe('resolveEnvOverrides', () => {
    it('picks up prefixed env vars', () => {
        process.env.CB_TEST_RESOLVE = 'abc';
        const result = resolveEnvOverrides('CB');
        expect(result).toBeDefined();
        delete process.env.CB_TEST_RESOLVE;
    });
});

describe('parseDotenv', () => {
    it('parses key=value', () => {
        expect(parseDotenv('KEY=value').KEY).toBe('value');
    });

    it('handles quoted values', () => {
        expect(parseDotenv('K="val"').K).toBe('val');
    });

    it('handles multiline', () => {
        expect(Object.keys(parseDotenv('A=1\nB=2\nC=3'))).toHaveLength(3);
    });

    it('ignores comments', () => {
        expect(Object.keys(parseDotenv('# comment\nK=v'))).toEqual(['K']);
    });

    it('handles empty', () => {
        expect(parseDotenv('')).toEqual({});
    });
});

describe('watchConfig', () => {
    let tmpFile: string;
    beforeEach(() => {
        tmpFile = path.join(os.tmpdir(), `watch-${Date.now()}.json`);
        fs.writeFileSync(tmpFile, JSON.stringify({ key: 'initial' }));
    });
    afterEach(() => { try { fs.unlinkSync(tmpFile); } catch { /* intentionally ignored */ } });

    it('returns a watcher', () => {
        const watcher = watchConfig(tmpFile, () => {});
        expect(watcher).toBeDefined();
        watcher.close();
    });
});
