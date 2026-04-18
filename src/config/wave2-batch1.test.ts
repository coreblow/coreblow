/**
 * Tests for Wave 2 Config Modules (Part 1):
 * Legacy Migration, Env Substitution, Group Policy, Config Paths
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Legacy Migration Tests ──────────────────────────────────────

import {
    detectLegacyConfig,
    migrateConfig,
    needsMigration,
    getMigrationSummary,
    registerMigrationRule,
    clearMigrationRules,
    getMigrationRules,
} from './legacy-migration.js';

describe('Legacy Migration', () => {
    it('should detect top-level apiKey', () => {
        const config = { apiKey: 'sk-test123' };
        const rules = detectLegacyConfig(config);
        expect(rules.length).toBeGreaterThan(0);
        expect(rules.some((r) => r.id === 'flatten-api-key')).toBe(true);
    });

    it('should migrate apiKey to models.providers.openai', () => {
        const result = migrateConfig({ apiKey: 'sk-test123' });
        expect(result.hasChanges).toBe(true);
        expect((result.config.models as any).providers.openai.apiKey).toBe('sk-test123');
        expect(result.config.apiKey).toBeUndefined();
    });

    it('should migrate top-level model to models.default', () => {
        const result = migrateConfig({ model: 'gpt-4o' });
        expect(result.hasChanges).toBe(true);
        expect((result.config.models as any).default).toBe('gpt-4o');
    });

    it('should migrate systemPrompt to agents.systemPrompt', () => {
        const result = migrateConfig({ systemPrompt: 'You are helpful' });
        expect((result.config.agents as any).systemPrompt).toBe('You are helpful');
    });

    it('should fix string temperature to number', () => {
        const result = migrateConfig({ models: { temperature: '0.5' } });
        expect((result.config.models as any).temperature).toBe(0.5);
    });

    it('should rename deprecated channel names', () => {
        const result = migrateConfig({ channels: { 'telegram-bot': { token: 'xx' } } });
        expect((result.config.channels as any).telegram).toBeDefined();
        expect((result.config.channels as any)['telegram-bot']).toBeUndefined();
    });

    it('should apply multiple migrations', () => {
        const result = migrateConfig({ apiKey: 'sk-test', model: 'gpt-4', maxTokens: 4096 });
        expect(result.migrationsApplied).toBeGreaterThanOrEqual(3);
    });

    it('should report no changes for clean config', () => {
        const result = migrateConfig({ models: { default: 'gpt-4', providers: {} } });
        expect(result.hasChanges).toBe(false);
    });

    it('should check needsMigration', () => {
        expect(needsMigration({ apiKey: 'sk-test' })).toBe(true);
        expect(needsMigration({ models: {} })).toBe(false);
    });

    it('should provide migration summaries', () => {
        const summaries = getMigrationSummary({ apiKey: 'sk-key', model: 'gpt-4' });
        expect(summaries.length).toBeGreaterThanOrEqual(2);
    });

    it('should support custom migration rules', () => {
        const ruleCount = getMigrationRules().length;
        registerMigrationRule({
            id: 'custom-test',
            description: 'Test rule',
            priority: 1000,
            detect: (c) => c.customField !== undefined,
            migrate: (c) => { const { customField, ...rest } = c; return { ...rest, custom: { field: customField } }; },
        });
        expect(getMigrationRules().length).toBe(ruleCount + 1);
        const result = migrateConfig({ customField: 'value' });
        expect((result.config.custom as any).field).toBe('value');
    });
});

// ─── Env Substitution Tests ──────────────────────────────────────

import {
    substituteEnvVars,
    substituteString,
    hasEnvVarReferences,
    extractEnvVarNames,
    validateEnvVars,
    MissingEnvVarError,
} from './env-substitution.js';

describe('Env Substitution', () => {
    const env = { MY_KEY: 'secret123', DB_HOST: 'localhost', PORT: '8080' };

    it('should substitute string values', () => {
        expect(substituteString('key=${MY_KEY}', env)).toBe('key=secret123');
    });

    it('should support default values', () => {
        expect(substituteString('${MISSING:-fallback}', env)).toBe('fallback');
    });

    it('should handle escape sequences', () => {
        expect(substituteString('literal $${NOT_A_VAR}', env)).toBe('literal ${NOT_A_VAR}');
    });

    it('should throw in strict mode for missing vars', () => {
        expect(() => substituteString('${DOES_NOT_EXIST}', env, true))
            .toThrow(MissingEnvVarError);
    });

    it('should substitute nested objects', () => {
        const result = substituteEnvVars({
            database: { host: '${DB_HOST}', port: '${PORT}' },
            apiKey: '${MY_KEY}',
        }, { env });
        const val = result.value as any;
        expect(val.database.host).toBe('localhost');
        expect(val.database.port).toBe('8080');
        expect(val.apiKey).toBe('secret123');
        expect(result.substitutions.length).toBe(3);
    });

    it('should substitute arrays', () => {
        const result = substituteEnvVars(['${MY_KEY}', 'static', '${DB_HOST}'], { env });
        expect((result.value as string[])[0]).toBe('secret123');
    });

    it('should detect env var references', () => {
        expect(hasEnvVarReferences('${VAR}')).toBe(true);
        expect(hasEnvVarReferences('no vars here')).toBe(false);
    });

    it('should extract env var names', () => {
        const names = extractEnvVarNames({
            a: '${FOO}', b: { c: '${BAR}' }, d: ['${BAZ}'],
        });
        expect(names).toContain('FOO');
        expect(names).toContain('BAR');
        expect(names).toContain('BAZ');
    });

    it('should validate env vars', () => {
        expect(validateEnvVars('${MY_KEY}', env).valid).toBe(true);
        expect(validateEnvVars('${NOPE}', env).valid).toBe(false);
        expect(validateEnvVars('${NOPE}', env).missing).toContain('NOPE');
    });

    it('should track missing vars', () => {
        const result = substituteEnvVars('${NOT_SET}', { env });
        expect(result.missingVars).toContain('NOT_SET');
    });
});

// ─── Group Policy Tests ──────────────────────────────────────────

import {
    resolveGroupPolicy,
    resolveChannelGroupPolicy,
    isValidGroupPolicy,
    describeGroupPolicy,
    policyRestrictiveness,
    moreRestrictive,
    lessRestrictive,
} from './group-policy.js';

describe('Group Policy', () => {
    it('should resolve explicit policy', () => {
        const result = resolveGroupPolicy({ providerConfigPresent: true, groupPolicy: 'closed' });
        expect(result.groupPolicy).toBe('closed');
        expect(result.source).toBe('explicit');
    });

    it('should use fallback for configured provider', () => {
        const result = resolveGroupPolicy({ providerConfigPresent: true });
        expect(result.groupPolicy).toBe('open');
        expect(result.source).toBe('fallback');
    });

    it('should use restrictive fallback for missing provider', () => {
        const result = resolveGroupPolicy({ providerConfigPresent: false });
        expect(result.groupPolicy).toBe('allowlist');
        expect(result.providerMissingFallbackApplied).toBe(true);
    });

    it('should respect channel overrides', () => {
        const result = resolveChannelGroupPolicy({
            channelId: 'telegram',
            providerConfigPresent: true,
            channelOverrides: { telegram: 'denylist' },
        });
        expect(result.groupPolicy).toBe('denylist');
    });

    it('should validate policies', () => {
        expect(isValidGroupPolicy('open')).toBe(true);
        expect(isValidGroupPolicy('allowlist')).toBe(true);
        expect(isValidGroupPolicy('invalid')).toBe(false);
    });

    it('should describe policies', () => {
        expect(describeGroupPolicy('open')).toContain('All users');
        expect(describeGroupPolicy('closed')).toContain('No users');
    });

    it('should compare restrictiveness', () => {
        expect(policyRestrictiveness('closed')).toBeGreaterThan(policyRestrictiveness('open'));
        expect(moreRestrictive('open', 'closed')).toBe('closed');
        expect(lessRestrictive('open', 'closed')).toBe('open');
    });
});

// ─── Config Paths Tests ──────────────────────────────────────────

import {
    getConfigPaths,
    findConfigFile,
    getDefaultConfigPath,
    ensureDirectoryExists,
    resolveConfigRelative,
} from './config-paths.js';

describe('Config Paths', () => {
    it('should return standard config paths', () => {
        const paths = getConfigPaths('/tmp/test-project');
        expect(paths.project).toContain('coreblow.json');
        expect(paths.home).toContain('.coreblow');
        expect(paths.data).toContain('coreblow');
    });

    it('should return default config path', () => {
        const p = getDefaultConfigPath('/tmp/test');
        expect(p).toContain('coreblow.json');
    });

    it('should find config file (returns search info)', () => {
        const result = findConfigFile('/tmp/nonexistent-dir');
        expect(result.searchedPaths.length).toBeGreaterThan(0);
        // May or may not find a config file
        expect(result.source).toBeDefined();
    });

    it('should resolve relative paths', () => {
        const resolved = resolveConfigRelative('secrets/keys.json', '/home/user/project/coreblow.json');
        expect(resolved).toContain('secrets');
    });

    it('should ensure directory exists', () => {
        const result = ensureDirectoryExists('/tmp/cb-test-dir-' + Date.now());
        expect(result).toBe(true);
    });
});
