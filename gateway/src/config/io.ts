/**
 * CoreBlow — Config I/O
 *
 * File system operations for config: read, write, watch, migrate.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CoreBlowConfig } from './types.js';
import { CONFIG_DEFAULTS, applyDefaults } from './defaults.js';
import { applyEnvOverrides } from './env-vars.js';
import { validateConfig, type ValidationIssue } from './validation.js';
import { deepMerge } from './merge-patch.js';

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');

/**
 * Resolve config file path (supports custom via --config flag or env).
 */
export function resolveConfigPath(customPath?: string): string {
    return customPath ?? process.env.COREBLOW_CONFIG ?? CONFIG_FILE;
}

/**
 * Read raw config from disk.
 */
export function readConfigFile(configPath?: string): Partial<CoreBlowConfig> | null {
    const filePath = resolveConfigPath(configPath);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw) as Partial<CoreBlowConfig>;
    } catch {
        return null;
    }
}

/**
 * Write config to disk (atomic write via temp file + rename).
 */
export function writeConfigFile(config: Partial<CoreBlowConfig>, configPath?: string): void {
    const filePath = resolveConfigPath(configPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    fs.renameSync(tempPath, filePath);
}

/**
 * Load fully resolved config: file → defaults → env overrides → validated.
 */
export function loadResolvedConfig(configPath?: string): {
    config: CoreBlowConfig;
    issues: ValidationIssue[];
    source: string;
} {
    const source = resolveConfigPath(configPath);
    const fileConfig = readConfigFile(source) ?? {};

    // Apply defaults
    let config = applyDefaults(fileConfig, CONFIG_DEFAULTS as unknown as Record<string, unknown>) as unknown as CoreBlowConfig;

    // Apply env overrides
    config = applyEnvOverrides(config as unknown as Record<string, unknown>) as unknown as CoreBlowConfig;

    // Validate
    const issues = validateConfig(config);

    return { config, issues, source };
}

/**
 * Check if config file exists.
 */
export function configExists(configPath?: string): boolean {
    return fs.existsSync(resolveConfigPath(configPath));
}

/**
 * Create backup of current config before modification.
 */
export function backupConfig(configPath?: string): string | null {
    const filePath = resolveConfigPath(configPath);
    if (!fs.existsSync(filePath)) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = `${filePath}.${timestamp}.bak`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
}

/**
 * Update config with partial changes (atomic read-modify-write).
 */
export function updateConfig(
    changes: Partial<CoreBlowConfig>,
    configPath?: string,
): { config: CoreBlowConfig; backup: string | null } {
    const backup = backupConfig(configPath);
    const current = readConfigFile(configPath) ?? {};
    const updated = deepMerge(current, changes as Record<string, unknown>) as unknown as CoreBlowConfig;
    writeConfigFile(updated as unknown as Partial<CoreBlowConfig>, configPath);
    return { config: updated, backup };
}

/**
 * Watch config file for changes.
 */
export function watchConfig(
    callback: (config: Partial<CoreBlowConfig>) => void,
    configPath?: string,
): fs.FSWatcher | null {
    const filePath = resolveConfigPath(configPath);
    if (!fs.existsSync(filePath)) return null;

    let debounce: ReturnType<typeof setTimeout> | null = null;

    return fs.watch(filePath, (eventType) => {
        if (eventType !== 'change') return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
            const config = readConfigFile(filePath);
            if (config) callback(config);
        }, 200);
    });
}

/**
 * Get config directory path.
 */
export function getConfigDir(): string { return CONFIG_DIR; }

/**
 * Get active config file path.
 */
export function getConfigFile(): string { return resolveConfigPath(); }
