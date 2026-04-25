/**
 * plugins/config-editor.ts
 *
 * Plugin Config Editor — Admin API for plugin config management UI.
 *
 * Following CoreBlow's config management patterns upgraded to CoreBlow OOP.
 * Provides a full API surface for an admin config editor:
 *   - Read current config with resolved defaults
 *   - Edit individual fields or entire config
 *   - Preview changes with validation before applying
 *   - Diff current vs proposed config
 *   - Reset to defaults (full or per-field)
 *   - Config history with undo/redo
 *   - Schema introspection for form rendering
 *   - Config presets (save/load named configs)
 *   - Export/import config bundles
 */

import { createChildLogger } from '../utils/logger.js';
import { PluginConfigValidator, type PluginConfigValidationResult, type ManifestConfigField } from './config-validator.js';

const log = createChildLogger('plugin:config-editor');

// ─── Types ───────────────────────────────────────────────────────

/** Config field metadata for UI form rendering */
export interface ConfigFieldMeta {
    key: string;
    type: string;
    label: string;
    description?: string;
    required: boolean;
    default?: unknown;
    currentValue: unknown;
    options?: string[];
    sensitive: boolean;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
    };
}

/** Config diff entry */
export interface ConfigDiff {
    field: string;
    oldValue: unknown;
    newValue: unknown;
    type: 'added' | 'changed' | 'removed' | 'unchanged';
}

/** Config change preview */
export interface ConfigPreview {
    pluginId: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
    diff: ConfigDiff[];
    resolvedConfig: Record<string, unknown>;
}

/** Config history entry */
export interface ConfigHistoryEntry {
    pluginId: string;
    config: Record<string, unknown>;
    timestamp: number;
    source: 'user' | 'reset' | 'preset' | 'import';
    label?: string;
}

/** Named config preset */
export interface ConfigPreset {
    name: string;
    pluginId: string;
    config: Record<string, unknown>;
    description?: string;
    createdAt: number;
}

/** Config editor statistics */
export interface ConfigEditorStats {
    totalPlugins: number;
    totalEdits: number;
    totalPresets: number;
    pluginsWithErrors: number;
}

/** Plugin config bundle for export/import */
export interface ConfigBundle {
    version: string;
    exportedAt: number;
    configs: Record<string, Record<string, unknown>>;
    presets: ConfigPreset[];
}

// ─── ConfigEditor ────────────────────────────────────────────────

/**
 * CoreBlow Plugin Config Editor
 *
 * Admin API for managing plugin configurations at runtime.
 * Provides read, edit, preview, diff, reset, history, presets,
 * and export/import for a config editor UI.
 */
export class ConfigEditor {
    private validator: PluginConfigValidator;
    /** Schema definitions per plugin */
    private schemas = new Map<string, ManifestConfigField[]>();
    /** Current configs per plugin */
    private configs = new Map<string, Record<string, unknown>>();
    /** Config history per plugin */
    private history = new Map<string, ConfigHistoryEntry[]>();
    /** Named presets */
    private presets = new Map<string, ConfigPreset>();
    /** Max history entries per plugin */
    private maxHistory: number;
    /** Edit counter */
    private editCount = 0;

    constructor(options?: { validator?: PluginConfigValidator; maxHistory?: number }) {
        this.validator = options?.validator ?? new PluginConfigValidator();
        this.maxHistory = options?.maxHistory ?? 50;
    }

    // ─── Schema Registration ─────────────────────────────────────

    /**
     * Register a plugin's config schema.
     */
    registerSchema(pluginId: string, schema: ManifestConfigField[]): void {
        this.schemas.set(pluginId, schema);
    }

    /**
     * Get a plugin's config schema.
     */
    getSchema(pluginId: string): ManifestConfigField[] | null {
        return this.schemas.get(pluginId) ?? null;
    }

    /**
     * Get schema as field metadata for UI form rendering.
     */
    getFieldMetas(pluginId: string): ConfigFieldMeta[] {
        const schema = this.schemas.get(pluginId);
        if (!schema) return [];

        const config = this.configs.get(pluginId) ?? {};

        return schema.map((field) => ({
            key: field.key,
            type: field.type,
            label: field.label ?? field.key,
            description: field.description,
            required: field.required ?? false,
            default: field.default,
            currentValue: config[field.key] ?? field.default,
            options: field.options,
            sensitive: field.type === 'password',
            validation: field.validation,
        }));
    }

    // ─── Read Config ─────────────────────────────────────────────

    /**
     * Get current config for a plugin (with defaults applied).
     */
    getConfig(pluginId: string): Record<string, unknown> {
        const schema = this.schemas.get(pluginId);
        const stored = this.configs.get(pluginId) ?? {};

        if (!schema) return { ...stored };

        return this.validator.applyDefaults(schema, stored);
    }

    /**
     * Get a single config field value.
     */
    getField(pluginId: string, fieldKey: string): unknown {
        const config = this.getConfig(pluginId);
        return config[fieldKey];
    }

    /**
     * Check if a plugin has a registered schema.
     */
    hasSchema(pluginId: string): boolean {
        return this.schemas.has(pluginId);
    }

    // ─── Edit Config ─────────────────────────────────────────────

    /**
     * Set the entire config for a plugin.
     */
    setConfig(pluginId: string, config: Record<string, unknown>): PluginConfigValidationResult {
        const schema = this.schemas.get(pluginId) ?? [];

        // Validate
        const result = this.validator.validatePluginConfig(pluginId, schema, config);

        // Apply even if invalid (store raw, validator records errors)
        const previous = this.configs.get(pluginId);
        this.configs.set(pluginId, result.resolvedConfig);
        this.editCount++;

        // Record history
        this.pushHistory(pluginId, result.resolvedConfig, 'user');

        log.info(`Config updated for ${pluginId}: ${result.valid ? 'valid' : `${result.errors.length} error(s)`}`);
        return result;
    }

    /**
     * Set a single config field.
     */
    setField(pluginId: string, fieldKey: string, value: unknown): PluginConfigValidationResult {
        const current = this.getConfig(pluginId);
        current[fieldKey] = value;
        return this.setConfig(pluginId, current);
    }

    /**
     * Remove a single config field (revert to default).
     */
    removeField(pluginId: string, fieldKey: string): PluginConfigValidationResult {
        const current = { ...this.configs.get(pluginId) ?? {} };
        delete current[fieldKey];
        return this.setConfig(pluginId, current);
    }

    // ─── Preview & Diff ──────────────────────────────────────────

    /**
     * Preview a config change without applying it.
     */
    preview(pluginId: string, proposed: Record<string, unknown>): ConfigPreview {
        const schema = this.schemas.get(pluginId) ?? [];
        const current = this.getConfig(pluginId);
        const result = this.validator.validatePluginConfig(`${pluginId}:preview`, schema, proposed);
        const diff = this.computeDiff(current, result.resolvedConfig);

        return {
            pluginId,
            valid: result.valid,
            errors: result.errors.map((e) => `${e.field}: ${e.message}`),
            warnings: result.warnings,
            diff,
            resolvedConfig: result.resolvedConfig,
        };
    }

    /**
     * Compute diff between current and proposed config.
     */
    diff(pluginId: string, proposed: Record<string, unknown>): ConfigDiff[] {
        const current = this.getConfig(pluginId);
        return this.computeDiff(current, proposed);
    }

    // ─── Reset ───────────────────────────────────────────────────

    /**
     * Reset config to schema defaults.
     */
    resetToDefaults(pluginId: string): PluginConfigValidationResult {
        const schema = this.schemas.get(pluginId) ?? [];
        const defaults: Record<string, unknown> = {};
        for (const field of schema) {
            if (field.default !== undefined) {
                defaults[field.key] = field.default;
            }
        }

        this.configs.set(pluginId, defaults);
        this.pushHistory(pluginId, defaults, 'reset', 'Reset to defaults');

        return this.validator.validatePluginConfig(pluginId, schema, defaults);
    }

    /**
     * Reset a single field to its default.
     */
    resetField(pluginId: string, fieldKey: string): unknown {
        const schema = this.schemas.get(pluginId);
        if (!schema) return undefined;

        const field = schema.find((f) => f.key === fieldKey);
        if (!field) return undefined;

        const config = { ...this.configs.get(pluginId) ?? {} };
        if (field.default !== undefined) {
            config[fieldKey] = field.default;
        } else {
            delete config[fieldKey];
        }
        this.configs.set(pluginId, config);
        return field.default;
    }

    // ─── History ─────────────────────────────────────────────────

    /**
     * Get config history for a plugin.
     */
    getHistory(pluginId: string, limit = 20): ConfigHistoryEntry[] {
        const history = this.history.get(pluginId) ?? [];
        return history.slice(-limit).map((h) => ({ ...h }));
    }

    /**
     * Revert to a specific history entry.
     */
    revertToHistory(pluginId: string, index: number): PluginConfigValidationResult | null {
        const history = this.history.get(pluginId);
        if (!history || index < 0 || index >= history.length) return null;

        const entry = history[index];
        return this.setConfig(pluginId, { ...entry.config });
    }

    /**
     * Undo last config change.
     */
    undo(pluginId: string): PluginConfigValidationResult | null {
        const history = this.history.get(pluginId);
        if (!history || history.length < 2) return null;

        // Go back to second-to-last entry
        const target = history[history.length - 2];
        return this.setConfig(pluginId, { ...target.config });
    }

    // ─── Presets ─────────────────────────────────────────────────

    /**
     * Save current config as a named preset.
     */
    savePreset(pluginId: string, name: string, description?: string): ConfigPreset {
        const config = this.getConfig(pluginId);
        const preset: ConfigPreset = {
            name,
            pluginId,
            config: { ...config },
            description,
            createdAt: Date.now(),
        };
        this.presets.set(`${pluginId}:${name}`, preset);
        return preset;
    }

    /**
     * Load a preset into a plugin's config.
     */
    loadPreset(pluginId: string, name: string): PluginConfigValidationResult | null {
        const preset = this.presets.get(`${pluginId}:${name}`);
        if (!preset) return null;

        const result = this.setConfig(pluginId, { ...preset.config });
        this.pushHistory(pluginId, this.getConfig(pluginId), 'preset', `Loaded preset: ${name}`);
        return result;
    }

    /**
     * Get all presets for a plugin.
     */
    getPresets(pluginId: string): ConfigPreset[] {
        return Array.from(this.presets.values())
            .filter((p) => p.pluginId === pluginId)
            .map((p) => ({ ...p }));
    }

    /**
     * Delete a preset.
     */
    deletePreset(pluginId: string, name: string): boolean {
        return this.presets.delete(`${pluginId}:${name}`);
    }

    // ─── Export / Import ─────────────────────────────────────────

    /**
     * Export all configs as a bundle.
     */
    exportBundle(): ConfigBundle {
        const configs: Record<string, Record<string, unknown>> = {};
        for (const [pluginId, config] of this.configs) {
            configs[pluginId] = { ...config };
        }

        return {
            version: '1.0.0',
            exportedAt: Date.now(),
            configs,
            presets: Array.from(this.presets.values()).map((p) => ({ ...p })),
        };
    }

    /**
     * Import configs from a bundle.
     */
    importBundle(bundle: ConfigBundle): { imported: number; errors: string[] } {
        const errors: string[] = [];
        let imported = 0;

        for (const [pluginId, config] of Object.entries(bundle.configs)) {
            try {
                this.configs.set(pluginId, config);
                this.pushHistory(pluginId, config, 'import', 'Imported from bundle');
                imported++;
            } catch (err) {
                errors.push(`Failed to import ${pluginId}: ${err}`);
            }
        }

        for (const preset of bundle.presets ?? []) {
            this.presets.set(`${preset.pluginId}:${preset.name}`, preset);
        }

        return { imported, errors };
    }

    // ─── Stats ───────────────────────────────────────────────────

    /**
     * Get editor statistics.
     */
    getStats(): ConfigEditorStats {
        let pluginsWithErrors = 0;
        for (const [pluginId] of this.configs) {
            const result = this.validator.getResult(pluginId);
            if (result && !result.valid) pluginsWithErrors++;
        }

        return {
            totalPlugins: this.configs.size,
            totalEdits: this.editCount,
            totalPresets: this.presets.size,
            pluginsWithErrors,
        };
    }

    /**
     * Get all plugin IDs with configs.
     */
    getConfiguredPlugins(): string[] {
        return Array.from(this.configs.keys());
    }

    /**
     * Remove all config data for a plugin.
     */
    removePlugin(pluginId: string): void {
        this.schemas.delete(pluginId);
        this.configs.delete(pluginId);
        this.history.delete(pluginId);
        // Remove presets
        for (const key of this.presets.keys()) {
            if (key.startsWith(`${pluginId}:`)) {
                this.presets.delete(key);
            }
        }
    }

    /**
     * Clear all data.
     */
    clear(): void {
        this.schemas.clear();
        this.configs.clear();
        this.history.clear();
        this.presets.clear();
        this.editCount = 0;
    }

    // ─── Private ─────────────────────────────────────────────────

    private pushHistory(pluginId: string, config: Record<string, unknown>, source: ConfigHistoryEntry['source'], label?: string): void {
        let history = this.history.get(pluginId);
        if (!history) {
            history = [];
            this.history.set(pluginId, history);
        }
        history.push({ pluginId, config: { ...config }, timestamp: Date.now(), source, label });
        if (history.length > this.maxHistory) {
            this.history.set(pluginId, history.slice(-this.maxHistory));
        }
    }

    private computeDiff(current: Record<string, unknown>, proposed: Record<string, unknown>): ConfigDiff[] {
        const diffs: ConfigDiff[] = [];
        const allKeys = new Set([...Object.keys(current), ...Object.keys(proposed)]);

        for (const key of allKeys) {
            const oldVal = current[key];
            const newVal = proposed[key];

            if (oldVal === undefined && newVal !== undefined) {
                diffs.push({ field: key, oldValue: oldVal, newValue: newVal, type: 'added' });
            } else if (oldVal !== undefined && newVal === undefined) {
                diffs.push({ field: key, oldValue: oldVal, newValue: newVal, type: 'removed' });
            } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                diffs.push({ field: key, oldValue: oldVal, newValue: newVal, type: 'changed' });
            } else {
                diffs.push({ field: key, oldValue: oldVal, newValue: newVal, type: 'unchanged' });
            }
        }

        return diffs;
    }
}
