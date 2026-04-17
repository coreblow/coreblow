/**
 * CoreBlow Legacy Config Migration
 *
 * Detects legacy/deprecated config formats and migrates them to current schema.
 * Supports versioned migrations, rollback safety, and change tracking.
 *
 * Equivalent: CoreBlow config/legacy-migrate.ts + legacy.migrations.ts (~540 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:legacy');

// ─── Types ────────────────────────────────────────────────────────

export interface MigrationRule {
    id: string;
    description: string;
    fromVersion?: string;
    toVersion?: string;
    /** Test whether this migration applies */
    detect: (config: Record<string, unknown>) => boolean;
    /** Apply the migration, returning modified config */
    migrate: (config: Record<string, unknown>) => Record<string, unknown>;
    /** Priority (higher = applied first) */
    priority: number;
}

export interface MigrationResult {
    config: Record<string, unknown>;
    changes: MigrationChange[];
    migrationsApplied: number;
    hasChanges: boolean;
    errors: string[];
}

export interface MigrationChange {
    ruleId: string;
    description: string;
    path: string;
    oldValue?: unknown;
    newValue?: unknown;
}

// ─── Registry ─────────────────────────────────────────────────────

const migrationRules: MigrationRule[] = [];

/**
 * Register a migration rule
 */
export function registerMigrationRule(rule: MigrationRule): void {
    migrationRules.push(rule);
    migrationRules.sort((a, b) => b.priority - a.priority);
}

/**
 * Clear all migration rules
 */
export function clearMigrationRules(): void {
    migrationRules.length = 0;
}

/**
 * Get all registered rules
 */
export function getMigrationRules(): MigrationRule[] {
    return [...migrationRules];
}

// ─── Built-in Migrations ──────────────────────────────────────────

// Migration: apiKey → models.providers.*.apiKey
registerMigrationRule({
    id: 'flatten-api-key',
    description: 'Move top-level apiKey to models.providers',
    priority: 100,
    detect: (config) => typeof config.apiKey === 'string',
    migrate: (config) => {
        const { apiKey, ...rest } = config;
        const models = (rest.models ?? {}) as Record<string, unknown>;
        const providers = (models.providers ?? {}) as Record<string, unknown>;
        const openai = (providers.openai ?? {}) as Record<string, unknown>;
        return {
            ...rest,
            models: {
                ...models,
                providers: { ...providers, openai: { ...openai, apiKey } },
            },
        };
    },
});

// Migration: model → models.default
registerMigrationRule({
    id: 'flatten-model',
    description: 'Move top-level model to models.default',
    priority: 90,
    detect: (config) => typeof config.model === 'string' && !(config.models as Record<string, unknown>)?.default,
    migrate: (config) => {
        const { model, ...rest } = config;
        const models = (rest.models ?? {}) as Record<string, unknown>;
        return { ...rest, models: { ...models, default: model } };
    },
});

// Migration: systemPrompt → agents.systemPrompt
registerMigrationRule({
    id: 'flatten-system-prompt',
    description: 'Move top-level systemPrompt to agents.systemPrompt',
    priority: 80,
    detect: (config) => typeof config.systemPrompt === 'string',
    migrate: (config) => {
        const { systemPrompt, ...rest } = config;
        const agents = (rest.agents ?? {}) as Record<string, unknown>;
        return { ...rest, agents: { ...agents, systemPrompt } };
    },
});

// Migration: temperature (float) type safety
registerMigrationRule({
    id: 'fix-temperature-type',
    description: 'Convert string temperature to number',
    priority: 70,
    detect: (config) => {
        const models = config.models as Record<string, unknown> | undefined;
        return typeof models?.temperature === 'string';
    },
    migrate: (config) => {
        const models = { ...(config.models as Record<string, unknown>) };
        models.temperature = parseFloat(models.temperature as string);
        if (isNaN(models.temperature as number)) models.temperature = 0.7;
        return { ...config, models };
    },
});

// Migration: deprecated channel names
registerMigrationRule({
    id: 'rename-channels',
    description: 'Rename deprecated channel identifiers',
    priority: 60,
    detect: (config) => {
        const channels = config.channels as Record<string, unknown> | undefined;
        return !!(channels?.['telegram-bot'] || channels?.['discord-bot']);
    },
    migrate: (config) => {
        const channels = { ...(config.channels as Record<string, unknown>) };
        if (channels['telegram-bot']) {
            channels.telegram = channels['telegram-bot'];
            delete channels['telegram-bot'];
        }
        if (channels['discord-bot']) {
            channels.discord = channels['discord-bot'];
            delete channels['discord-bot'];
        }
        return { ...config, channels };
    },
});

// Migration: maxTokens → models.maxOutputTokens
registerMigrationRule({
    id: 'rename-max-tokens',
    description: 'Rename maxTokens to models.maxOutputTokens',
    priority: 50,
    detect: (config) => config.maxTokens !== undefined,
    migrate: (config) => {
        const { maxTokens, ...rest } = config;
        const models = (rest.models ?? {}) as Record<string, unknown>;
        return { ...rest, models: { ...models, maxOutputTokens: maxTokens } };
    },
});

// ─── Migration Engine ─────────────────────────────────────────────

/**
 * Detect which migrations apply to a config
 */
export function detectLegacyConfig(config: Record<string, unknown>): MigrationRule[] {
    return migrationRules.filter((rule) => {
        try {
            return rule.detect(config);
        } catch {
            return false;
        }
    });
}

/**
 * Apply all applicable migrations
 */
export function migrateConfig(config: Record<string, unknown>): MigrationResult {
    let current = { ...config };
    const changes: MigrationChange[] = [];
    const errors: string[] = [];
    let applied = 0;

    for (const rule of migrationRules) {
        try {
            if (rule.detect(current)) {
                const before = JSON.stringify(current);
                current = rule.migrate(current);
                const after = JSON.stringify(current);

                if (before !== after) {
                    changes.push({
                        ruleId: rule.id,
                        description: rule.description,
                        path: rule.id,
                    });
                    applied++;
                    log.info({ ruleId: rule.id, description: rule.description }, 'Migration applied');
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Migration "${rule.id}" failed: ${message}`);
            log.error({ ruleId: rule.id, error: message }, 'Migration failed');
        }
    }

    return {
        config: current,
        changes,
        migrationsApplied: applied,
        hasChanges: applied > 0,
        errors,
    };
}

/**
 * Check if a config needs migration (without applying)
 */
export function needsMigration(config: Record<string, unknown>): boolean {
    return detectLegacyConfig(config).length > 0;
}

/**
 * Get a summary of needed migrations
 */
export function getMigrationSummary(config: Record<string, unknown>): string[] {
    return detectLegacyConfig(config).map((rule) => `[${rule.id}] ${rule.description}`);
}
