/**
 * CoreBlow — Config Loader
 *
 * Unified configuration loading from multiple sources:
 * files (JSON/YAML-like), environment variables, CLI args,
 * and defaults. Supports nested keys, type coercion,
 * and config merging with precedence.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logCaughtError } from '../utils/error-boundary.js';

/** Config source precedence (highest wins) */
export type ConfigSource = 'default' | 'file' | 'env' | 'cli' | 'runtime';

/** Config entry with provenance */
interface ConfigEntry {
    value: unknown;
    source: ConfigSource;
    key: string;
}

/**
 * CoreBlow Config Loader
 */
export class ConfigLoader {
    private config = new Map<string, ConfigEntry>();
    private defaults = new Map<string, unknown>();
    private envPrefix = 'CB_';

    constructor(envPrefix?: string) {
        if (envPrefix) this.envPrefix = envPrefix;
    }

    /**
     * Set default values.
     */
    setDefaults(defaults: Record<string, unknown>): void {
        for (const [key, value] of Object.entries(defaults)) {
            this.defaults.set(key, value);
            if (!this.config.has(key)) {
                this.config.set(key, { value, source: 'default', key });
            }
        }
    }

    /**
     * Load from a JSON file.
     */
    loadFile(filePath: string): boolean {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            this.mergeObject(data, 'file');
            return true;
        } catch (e) {
            logCaughtError('config-loader:loadFile', e);
            return false;
        }
    }

    /**
     * Load from environment variables.
     * Maps CB_AGENTS_MODEL → agents.model
     */
    loadEnv(env?: Record<string, string | undefined>): number {
        const source = env ?? process.env;
        let count = 0;

        for (const [key, value] of Object.entries(source)) {
            if (key.startsWith(this.envPrefix) && value !== undefined) {
                const configKey = key
                    .slice(this.envPrefix.length)
                    .toLowerCase()
                    .replace(/_/g, '.');
                this.set(configKey, this.coerce(value), 'env');
                count++;
            }
        }
        return count;
    }

    /**
     * Load from CLI arguments.
     * --model=gpt-4o → model: "gpt-4o"
     */
    loadArgs(args: string[]): number {
        let count = 0;
        for (const arg of args) {
            if (arg.startsWith('--')) {
                const eqIdx = arg.indexOf('=');
                if (eqIdx > 0) {
                    const key = arg.slice(2, eqIdx).replace(/-/g, '.');
                    const value = arg.slice(eqIdx + 1);
                    this.set(key, this.coerce(value), 'cli');
                    count++;
                } else {
                    // Boolean flag: --verbose → verbose: true
                    const key = arg.slice(2).replace(/-/g, '.');
                    this.set(key, true, 'cli');
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Set a config value at runtime.
     */
    set(key: string, value: unknown, source: ConfigSource = 'runtime'): void {
        const existing = this.config.get(key);
        const precedence: ConfigSource[] = ['default', 'file', 'env', 'cli', 'runtime'];

        if (!existing || precedence.indexOf(source) >= precedence.indexOf(existing.source)) {
            this.config.set(key, { value, source, key });
        }
    }

    /**
     * Get a config value.
     */
    get<T = unknown>(key: string, defaultValue?: T): T {
        const entry = this.config.get(key);
        if (entry) return entry.value as T;
        return (this.defaults.get(key) as T) ?? defaultValue as T;
    }

    /**
     * Get a required config value (throws if missing).
     */
    getRequired<T = unknown>(key: string): T {
        const value = this.get<T>(key);
        if (value === undefined) throw new Error(`Required config "${key}" not found`);
        return value;
    }

    /**
     * Check if a key exists.
     */
    has(key: string): boolean {
        return this.config.has(key) || this.defaults.has(key);
    }

    /**
     * Get all config as a flat object.
     */
    getAll(): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of Array.from(this.config)) {
            result[key] = entry.value;
        }
        return result;
    }

    /**
     * Get config provenance (where each value came from).
     */
    getProvenance(): Array<{ key: string; source: ConfigSource; value: unknown }> {
        return Array.from(this.config.values()).map((e) => ({
            key: e.key,
            source: e.source,
            value: e.value,
        }));
    }

    // === Private ===

    private mergeObject(obj: Record<string, unknown>, source: ConfigSource, prefix: string = ''): void {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.mergeObject(value as Record<string, unknown>, source, fullKey);
            } else {
                this.set(fullKey, value, source);
            }
        }
    }

    private coerce(value: string): unknown {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        return value;
    }
}
