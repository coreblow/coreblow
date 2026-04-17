/**
 * plugins/migration.ts
 *
 * Plugin Data Migration — manages versioned data migrations between
 * plugin versions to ensure smooth upgrades.
 *
 * Following CoreBlow's plugins/migration.ts (~400 LOC) +
 * plugins/schema-migrate.ts (~250 LOC) pattern, consolidated into a
 * single OOP migration engine with ordered step execution and rollback.
 *
 * Features:
 *   - Versioned migration steps
 *   - Ordered execution (oldest → newest)
 *   - Dry run mode
 *   - Rollback support
 *   - Migration history tracking
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:migration');

// ─── Types ──────────────────────────────────────────────────────

export interface MigrationStep {
    version: string;
    description: string;
    up: (data: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
    down?: (data: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface MigrationResult {
    success: boolean;
    fromVersion: string;
    toVersion: string;
    stepsApplied: string[];
    data: Record<string, unknown>;
    errors: string[];
    dryRun: boolean;
}

export interface MigrationHistory {
    pluginId: string;
    version: string;
    appliedAt: number;
    direction: 'up' | 'down';
}

// ─── PluginMigrationEngine ──────────────────────────────────────

/**
 * PluginMigrationEngine
 *
 * OOP equivalent of CoreBlow's migration pipeline.
 * Manages versioned data transformations for plugin config/data upgrades.
 */
export class PluginMigrationEngine {
    private steps = new Map<string, MigrationStep[]>();  // pluginId → steps
    private history: MigrationHistory[] = [];

    /**
     * Register migration steps for a plugin.
     */
    registerSteps(pluginId: string, steps: MigrationStep[]): void {
        const existing = this.steps.get(pluginId) ?? [];
        existing.push(...steps);
        // Sort by version
        existing.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
        this.steps.set(pluginId, existing);
    }

    /**
     * Get migration steps for a plugin.
     */
    getSteps(pluginId: string): MigrationStep[] {
        return this.steps.get(pluginId) ?? [];
    }

    /**
     * Migrate data from one version to another.
     */
    async migrate(
        pluginId: string,
        fromVersion: string,
        toVersion: string,
        data: Record<string, unknown>,
        dryRun = false,
    ): Promise<MigrationResult> {
        const steps = this.getSteps(pluginId);
        const result: MigrationResult = {
            success: true,
            fromVersion,
            toVersion,
            stepsApplied: [],
            data: { ...data },
            errors: [],
            dryRun,
        };

        // Filter applicable steps
        const applicable = steps.filter(s =>
            s.version.localeCompare(fromVersion, undefined, { numeric: true }) > 0 &&
            s.version.localeCompare(toVersion, undefined, { numeric: true }) <= 0,
        );

        if (applicable.length === 0) {
            return result;
        }

        for (const step of applicable) {
            try {
                if (!dryRun) {
                    result.data = await step.up(result.data);
                    this.history.push({
                        pluginId,
                        version: step.version,
                        appliedAt: Date.now(),
                        direction: 'up',
                    });
                }
                result.stepsApplied.push(step.version);
            } catch (err) {
                result.success = false;
                result.errors.push(`Step ${step.version}: ${err instanceof Error ? err.message : String(err)}`);
                break;
            }
        }

        return result;
    }

    /**
     * Rollback a specific version step.
     */
    async rollback(
        pluginId: string,
        version: string,
        data: Record<string, unknown>,
    ): Promise<MigrationResult> {
        const steps = this.getSteps(pluginId);
        const step = steps.find(s => s.version === version);

        const result: MigrationResult = {
            success: false,
            fromVersion: version,
            toVersion: 'rollback',
            stepsApplied: [],
            data: { ...data },
            errors: [],
            dryRun: false,
        };

        if (!step) {
            result.errors.push(`No migration step found for version ${version}`);
            return result;
        }

        if (!step.down) {
            result.errors.push(`No rollback (down) function for version ${version}`);
            return result;
        }

        try {
            result.data = await step.down(result.data);
            result.success = true;
            result.stepsApplied.push(version);
            this.history.push({
                pluginId,
                version,
                appliedAt: Date.now(),
                direction: 'down',
            });
        } catch (err) {
            result.errors.push(`Rollback ${version}: ${err instanceof Error ? err.message : String(err)}`);
        }

        return result;
    }

    /**
     * Check if migration is needed.
     */
    needsMigration(pluginId: string, fromVersion: string, toVersion: string): boolean {
        const steps = this.getSteps(pluginId);
        return steps.some(s =>
            s.version.localeCompare(fromVersion, undefined, { numeric: true }) > 0 &&
            s.version.localeCompare(toVersion, undefined, { numeric: true }) <= 0,
        );
    }

    /**
     * Get pending migration versions.
     */
    getPendingVersions(pluginId: string, fromVersion: string, toVersion: string): string[] {
        const steps = this.getSteps(pluginId);
        return steps
            .filter(s =>
                s.version.localeCompare(fromVersion, undefined, { numeric: true }) > 0 &&
                s.version.localeCompare(toVersion, undefined, { numeric: true }) <= 0,
            )
            .map(s => s.version);
    }

    /**
     * Get migration history.
     */
    getHistory(pluginId?: string): MigrationHistory[] {
        if (pluginId) return this.history.filter(h => h.pluginId === pluginId);
        return [...this.history];
    }

    /**
     * Clear all data.
     */
    clear(): void {
        this.steps.clear();
        this.history = [];
    }
}
