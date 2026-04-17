/**
 * plugins/config-state.ts
 *
 * Plugin config state management — normalization, validation,
 * enable/disable state resolution, and config defaults.
 *
 * Following CoreBlow's config-state.ts (341 LOC) + config-schema.ts (128 LOC) pattern.
 */

import { createChildLogger } from '../utils/logger.js';
import type {
    PluginConfigSchema,
    PluginConfigValidation,
    PluginLogger,
} from './types.js';

const log = createChildLogger('plugin:config');

// ─── Types ───────────────────────────────────────────────────────

/** Normalized plugin configuration from config.json */
export interface NormalizedPluginsConfig {
    /** Whether plugins are enabled globally */
    enabled: boolean;
    /** Allowed plugin IDs (empty = allow all discoverable) */
    allow: string[];
    /** Denied plugin IDs */
    deny: string[];
    /** Per-plugin config overrides */
    pluginConfigs: Record<string, Record<string, unknown>>;
    /** Additional load paths */
    loadPaths: string[];
    /** Per-plugin enable overrides */
    enableOverrides: Record<string, boolean>;
}

/** Config validation result */
export interface ConfigValidationResult {
    ok: boolean;
    value?: Record<string, unknown>;
    errors?: string[];
}

// ─── PluginConfigState ───────────────────────────────────────────

/**
 * CoreBlow Plugin Config State
 *
 * Manages plugin configuration normalization, validation against schemas,
 * and enable/disable state resolution with layered override support.
 */
export class PluginConfigState {
    private logger: PluginLogger;

    constructor(logger?: PluginLogger) {
        this.logger = logger ?? {
            info: (msg) => log.info(msg),
            warn: (msg) => log.warn(msg),
            error: (msg) => log.error(msg),
            debug: (msg) => log.debug(msg),
        };
    }

    /**
     * Normalize raw plugins config from config.json into a clean shape.
     */
    normalize(raw?: Record<string, unknown>): NormalizedPluginsConfig {
        if (!raw) {
            return {
                enabled: true,
                allow: [],
                deny: [],
                pluginConfigs: {},
                loadPaths: [],
                enableOverrides: {},
            };
        }

        const enabled = raw.enabled !== false;
        const allow = this.normalizeStringArray(raw.allow);
        const deny = this.normalizeStringArray(raw.deny);
        const loadPaths = this.normalizeStringArray(raw.loadPaths);

        // Per-plugin configs
        const pluginConfigs: Record<string, Record<string, unknown>> = {};
        if (raw.configs && typeof raw.configs === 'object') {
            for (const [key, value] of Object.entries(raw.configs as Record<string, unknown>)) {
                if (value && typeof value === 'object') {
                    pluginConfigs[key] = value as Record<string, unknown>;
                }
            }
        }

        // Per-plugin enable overrides
        const enableOverrides: Record<string, boolean> = {};
        if (raw.enable && typeof raw.enable === 'object') {
            for (const [key, value] of Object.entries(raw.enable as Record<string, unknown>)) {
                if (typeof value === 'boolean') {
                    enableOverrides[key] = value;
                }
            }
        }

        return { enabled, allow, deny, pluginConfigs, loadPaths, enableOverrides };
    }

    /**
     * Resolve effective enable state for a specific plugin.
     *
     * Priority order:
     * 1. Per-plugin enable override (highest)
     * 2. Deny list
     * 3. Allow list (if non-empty, only listed plugins are allowed)
     * 4. Global enabled flag (lowest)
     */
    resolveEnableState(
        pluginId: string,
        config: NormalizedPluginsConfig,
    ): { enabled: boolean; reason: string } {
        // 1. Explicit per-plugin override
        if (pluginId in config.enableOverrides) {
            const enabled = config.enableOverrides[pluginId];
            return { enabled, reason: enabled ? 'enable-override' : 'disable-override' };
        }

        // 2. Deny list
        if (config.deny.includes(pluginId)) {
            return { enabled: false, reason: 'deny-list' };
        }

        // 3. Allow list (if non-empty, acts as whitelist)
        if (config.allow.length > 0 && !config.allow.includes(pluginId)) {
            return { enabled: false, reason: 'not-in-allow-list' };
        }

        // 4. Global flag
        return { enabled: config.enabled, reason: config.enabled ? 'global-enabled' : 'global-disabled' };
    }

    /**
     * Validate plugin config against a schema.
     */
    validateConfig(
        schema: PluginConfigSchema | undefined,
        value: unknown,
    ): ConfigValidationResult {
        if (!schema) {
            return { ok: true, value: value as Record<string, unknown> };
        }

        // Try Zod-style safeParse first
        if (schema.safeParse) {
            const result = schema.safeParse(value);
            if (result.success) {
                return { ok: true, value: result.data as Record<string, unknown> };
            }
            const errors = result.error?.issues?.map(
                (issue) => `${issue.path.join('.')}: ${issue.message}`,
            ) ?? ['Validation failed'];
            return { ok: false, errors };
        }

        // Try lightweight validate
        if (schema.validate) {
            const result = schema.validate(value);
            if (result.ok) {
                return { ok: true, value: result.value as Record<string, unknown> };
            }
            return { ok: false, errors: result.errors };
        }

        // Try Zod-style parse (throws on error)
        if (schema.parse) {
            try {
                const parsed = schema.parse(value);
                return { ok: true, value: parsed as Record<string, unknown> };
            } catch (err) {
                return { ok: false, errors: [String(err)] };
            }
        }

        // No validation method available — pass through
        return { ok: true, value: value as Record<string, unknown> };
    }

    /**
     * Get plugin-specific config with defaults applied.
     */
    getPluginConfig(
        pluginId: string,
        config: NormalizedPluginsConfig,
        defaults?: Record<string, unknown>,
    ): Record<string, unknown> {
        const pluginConfig = config.pluginConfigs[pluginId] ?? {};
        if (defaults) {
            return { ...defaults, ...pluginConfig };
        }
        return { ...pluginConfig };
    }

    /**
     * Get plugin config with validated/resolved config merged in.
     *
     * Priority order:
     * 1. User-provided per-plugin config overrides (highest)
     * 2. Validated + resolved config (with defaults from schema)
     * 3. Empty config (lowest)
     */
    getValidatedPluginConfig(
        pluginId: string,
        config: NormalizedPluginsConfig,
        validatedConfig: Record<string, unknown>,
    ): Record<string, unknown> {
        const userOverrides = config.pluginConfigs[pluginId] ?? {};
        return { ...validatedConfig, ...userOverrides };
    }

    // ─── Private ─────────────────────────────────────────────────

    private normalizeStringArray(value: unknown): string[] {
        if (Array.isArray(value)) {
            return value
                .filter((v): v is string => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean);
        }
        return [];
    }
}
