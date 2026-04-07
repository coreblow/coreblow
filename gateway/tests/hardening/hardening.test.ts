/**
 * Phase E: Source Hardening Tests
 * Tests: Input validation, injection protection, bounds enforcement,
 *        config validation, config migration, nested helpers
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { execRestricted } from '../../src/sandbox/exec-restricted.js';
import { ConfigValidator, getNestedValue, setNestedValue } from '../../src/gateway/config-validator.js';

// ═══════════════════════════════════════════════════════════════════
// execRestricted — Input Hardening
// ═══════════════════════════════════════════════════════════════════

describe('execRestricted Hardening', () => {
    // --- Null byte injection ---
    it('rejects null bytes in command', async () => {
        const r = await execRestricted('echo hello\0world');
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain('null bytes');
    });

    // --- Overlong command ---
    it('rejects excessively long commands', async () => {
        const longCmd = 'echo ' + 'x'.repeat(40000);
        const r = await execRestricted(longCmd);
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain('max length');
    });

    // --- Empty/invalid ---
    it('rejects empty command', async () => {
        const r = await execRestricted('');
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain('Invalid');
    });

    // --- Timeout bounds ---
    it('enforces minimum timeout (100ms)', async () => {
        const r = await execRestricted('echo ok', { timeout: 1 });
        // Should still work (clamped to 100ms minimum)
        expect(r.mode).toBe('restricted-native');
    });

    // --- Valid commands still work ---
    it('allows normal short commands', async () => {
        const r = await execRestricted('echo hardened');
        expect(r.stdout.trim()).toBe('hardened');
        expect(r.exitCode).toBe(0);
    });

    it('handles pipe commands', async () => {
        const r = await execRestricted('echo "a b c" | wc -w');
        expect(r.exitCode).toBe(0);
        expect(r.stdout.trim()).toBe('3');
    });

    it('handles environment variables in commands', async () => {
        const r = await execRestricted('echo $HOME');
        expect(r.exitCode).toBe(0);
        expect(r.stdout.trim().length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// ConfigValidator — Deep Coverage
// ═══════════════════════════════════════════════════════════════════

describe('ConfigValidator', () => {
    let validator: ConfigValidator;

    beforeEach(() => { validator = new ConfigValidator(); });

    // --- Valid Config ---
    it('validates empty config (defaults applied)', () => {
        const result = validator.validate({});
        expect(result.valid).toBe(true);
        expect(result.applied.length).toBeGreaterThan(0);
    });

    it('validates full config', () => {
        const result = validator.validate({
            port: 8080, host: 'localhost',
            agent: { provider: 'openai', model: 'gpt-4o', maxTokens: 8192, temperature: 0.5, workspace: '/code' },
        });
        expect(result.valid).toBe(true);
    });

    // --- Type Validation ---
    it('rejects wrong type for port', () => {
        const result = validator.validate({ port: 'not a number' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'port')).toBe(true);
    });

    it('rejects wrong type for host', () => {
        const result = validator.validate({ host: 123 });
        expect(result.valid).toBe(false);
    });

    // --- Range Validation ---
    it('rejects port below 1', () => {
        const result = validator.validate({ port: 0 });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('below minimum'))).toBe(true);
    });

    it('rejects port above 65535', () => {
        const result = validator.validate({ port: 99999 });
        expect(result.valid).toBe(false);
    });

    it('rejects temperature above 2', () => {
        const result = validator.validate({ agent: { temperature: 5.0 } });
        expect(result.valid).toBe(false);
    });

    it('rejects maxTokens below 1', () => {
        const result = validator.validate({ agent: { maxTokens: 0 } });
        expect(result.valid).toBe(false);
    });

    // --- Defaults ---
    it('applies default port', () => {
        const config: any = {};
        validator.validate(config);
        expect(config.port).toBe(3100);
    });

    it('applies default host', () => {
        const config: any = {};
        validator.validate(config);
        expect(config.host).toBe('0.0.0.0');
    });

    it('applies nested defaults', () => {
        const config: any = {};
        validator.validate(config);
        expect(config.agent.provider).toBe('anthropic');
        expect(config.agent.temperature).toBe(0.7);
    });

    // --- Custom Rules ---
    it('adds and enforces custom rules', () => {
        validator.addRules([
            { path: 'custom.name', type: 'string', required: true, description: 'Custom name' },
        ]);
        const result = validator.validate({});
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'custom.name')).toBe(true);
    });

    it('supports custom validator function', () => {
        validator.addRules([{
            path: 'custom.url', type: 'string', required: false,
            validate: (v) => (v as string).startsWith('http') ? null : 'Must be a URL',
        }]);
        const result = validator.validate({ custom: { url: 'not-a-url' } });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('Must be a URL'))).toBe(true);
    });

    it('supports pattern validation', () => {
        validator.addRules([{
            path: 'custom.code', type: 'string', required: false, pattern: /^[A-Z]{3}$/,
        }]);
        const result = validator.validate({ custom: { code: 'abc' } });
        expect(result.valid).toBe(false);
    });

    it('supports enum validation', () => {
        validator.addRules([{
            path: 'custom.mode', type: 'string', required: false, enum: ['dev', 'prod', 'test'],
        }]);
        const result = validator.validate({ custom: { mode: 'staging' } });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('must be one of'))).toBe(true);
    });

    // --- Migrations ---
    it('runs config migration', () => {
        validator.addMigration({
            fromVersion: 1, toVersion: 2, description: 'Rename field',
            migrate: (c) => { c.newField = c.oldField; delete c.oldField; return c; },
        });
        const migrated = validator.migrate({ oldField: 'value' }, 1, 2);
        expect(migrated.newField).toBe('value');
        expect(migrated.oldField).toBeUndefined();
    });

    it('runs multiple migrations in order', () => {
        validator.addMigration({
            fromVersion: 1, toVersion: 2, description: 'v1→v2',
            migrate: (c) => { c.step1 = true; return c; },
        });
        validator.addMigration({
            fromVersion: 2, toVersion: 3, description: 'v2→v3',
            migrate: (c) => { c.step2 = true; return c; },
        });
        const migrated = validator.migrate({}, 1, 3);
        expect(migrated.step1).toBe(true);
        expect(migrated.step2).toBe(true);
    });

    it('skips non-applicable migrations', () => {
        validator.addMigration({
            fromVersion: 5, toVersion: 6, description: 'future',
            migrate: (c) => { c.future = true; return c; },
        });
        const migrated = validator.migrate({}, 1, 3);
        expect(migrated.future).toBeUndefined();
    });

    // --- Schema ---
    it('returns schema documentation', () => {
        const schema = validator.getSchema();
        expect(schema.length).toBeGreaterThan(5);
        expect(schema.some(s => s.path === 'port')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Nested Helpers
// ═══════════════════════════════════════════════════════════════════

describe('getNestedValue', () => {
    it('gets top-level value', () => {
        expect(getNestedValue({ a: 1 }, 'a')).toBe(1);
    });

    it('gets nested value', () => {
        expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('returns undefined for missing path', () => {
        expect(getNestedValue({}, 'a.b.c')).toBeUndefined();
    });

    it('returns undefined for null intermediate', () => {
        expect(getNestedValue({ a: null } as any, 'a.b')).toBeUndefined();
    });
});

describe('setNestedValue', () => {
    it('sets top-level value', () => {
        const obj: any = {};
        setNestedValue(obj, 'a', 1);
        expect(obj.a).toBe(1);
    });

    it('sets nested value creating intermediates', () => {
        const obj: any = {};
        setNestedValue(obj, 'a.b.c', 42);
        expect(obj.a.b.c).toBe(42);
    });

    it('overwrites existing value', () => {
        const obj: any = { a: { b: 1 } };
        setNestedValue(obj, 'a.b', 2);
        expect(obj.a.b).toBe(2);
    });
});
