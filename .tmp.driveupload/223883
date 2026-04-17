// @ts-nocheck
/**
 * config/config-io.ts
 *
 * Lightweight config file read/write for CoreBlow.
 * Unblocks: `config set/unset` CLI commands + MCP config persistence.
 *
 * [PORT] coreblow/src/config/io.ts (writeConfigFile / readConfigFileSnapshot)
 * Adaptasi (CoreBlow → CoreBlow):
 *   - Hapus JSON5, shell-env, owner-display, backup-rotation complex deps
 *   - Pure JSON read/write dengan atomic rename (tmp → final)
 *   - Resolve config path via CoreBlow config-paths.ts (getConfigPaths)
 *   - Merge via applyMergePatch (JSON Merge Patch, RFC 7396)
 *
 * CoreBlow deps yang tidak diport:
 *   - JSON5 parsing (CoreBlow hanya JSON)
 *   - config-audit.jsonl logging
 *   - config-health.json state tracking
 *   - shell-env fallback, owner-display, agent-dirs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { CoreBlowConfig } from './config.js';
import { getConfigPaths, findConfigFile } from './config-paths.js';
import { loadConfig } from './config.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WriteConfigFileResult =
    | { ok: true; path: string }
    | { ok: false; error: string };

export type ReadConfigResult =
    | { ok: true; config: CoreBlowConfig; path: string }
    | { ok: false; error: string; path: string };

export type ConfigIoOptions = {
    /** Override config path (default: auto-resolved via findConfigFile) */
    configPath?: string;
};

// ─── resolveWritableConfigPath ────────────────────────────────────────────────

/**
 * Resolve the writable config file path.
 * Priority: explicit > env COREBLOW_CONFIG > project dir > home dir.
 * [PORT] coreblow resolveConfigPath() simplified
 */
export function resolveWritableConfigPath(opts: ConfigIoOptions = {}): string {
    // 1. Explicit override
    if (opts.configPath) return opts.configPath;

    // 2. Env var
    const envPath = process.env.COREBLOW_CONFIG;
    if (envPath) return envPath;

    // 3. Already-existing config file (read from existing location)
    const found = findConfigFile();
    if (found.configPath) return found.configPath;

    // 4. Default: XDG-aware home config
    const paths = getConfigPaths();
    return paths.xdg;
}

// ─── readConfigFileRaw ────────────────────────────────────────────────────────

/**
 * Read and parse the config JSON file.
 * Returns empty config if file does not exist.
 * [PORT] coreblow readConfigFileSnapshot() − sans JSON5
 */
export function readConfigFileRaw(configPath: string): ReadConfigResult {
    try {
        if (!fs.existsSync(configPath)) {
            return { ok: true, config: {}, path: configPath };
        }
        const raw = fs.readFileSync(configPath, 'utf8').trim();
        if (!raw) {
            return { ok: true, config: {}, path: configPath };
        }
        const parsed = JSON.parse(raw) as CoreBlowConfig;
        return { ok: true, config: parsed, path: configPath };
    } catch (err) {
        return {
            ok: false,
            error: `Failed to read config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
            path: configPath,
        };
    }
}

// ─── writeConfigFileAtomic ────────────────────────────────────────────────────

/**
 * Write config JSON to disk atomically (tmp file → rename).
 * Creates parent directories as needed.
 * [PORT] coreblow writeConfigFile() atomic rename pattern
 */
export function writeConfigFileAtomic(
    configPath: string,
    config: CoreBlowConfig,
): WriteConfigFileResult {
    try {
        const dir = path.dirname(configPath);

        // Ensure directory exists
        fs.mkdirSync(dir, { recursive: true });

        const json = JSON.stringify(config, null, 2) + '\n';
        const tmpPath = path.join(dir, `.coreblow-config-${crypto.randomBytes(6).toString('hex')}.tmp`);

        try {
            fs.writeFileSync(tmpPath, json, { encoding: 'utf8', mode: 0o600 });
            fs.renameSync(tmpPath, configPath);
        } catch (writeErr) {
            // Fallback: direct write if rename fails (e.g. cross-device)
            try {
                fs.unlinkSync(tmpPath);
            } catch {
                // ignore cleanup error
            }
            fs.writeFileSync(configPath, json, { encoding: 'utf8', mode: 0o600 });
        }

        return { ok: true, path: configPath };
    } catch (err) {
        return {
            ok: false,
            error: `Failed to write config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

// ─── deepMerge ────────────────────────────────────────────────────────────────

/**
 * Deep merge `patch` into `base` (JSON Merge Patch, RFC 7396).
 * Null values in patch delete keys from base.
 * [PORT] coreblow applyMergePatch() simplified
 */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) {
            delete result[key];
        } else if (
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            result[key] = deepMerge(
                result[key] as Record<string, unknown>,
                value as Record<string, unknown>,
            );
        } else {
            result[key] = value;
        }
    }
    return result;
}

// ─── setConfigValue ───────────────────────────────────────────────────────────

/**
 * Set a dot-path config value and persist it.
 * e.g. `setConfigValue('gateway.mode', 'remote')` writes:
 *   { "gateway": { "mode": "remote" } }
 */
export async function setConfigValue(
    dotPath: string,
    value: unknown,
    opts: ConfigIoOptions = {},
): Promise<WriteConfigFileResult> {
    const configPath = resolveWritableConfigPath(opts);
    const read = readConfigFileRaw(configPath);
    if (!read.ok) return { ok: false, error: read.error };

    // Build patch object from dot-path
    const parts = dotPath.split('.');
    let patch: Record<string, unknown> = {};
    let current = patch;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        current[part] = {};
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]!] = value;

    const merged = deepMerge(read.config as Record<string, unknown>, patch) as CoreBlowConfig;
    return writeConfigFileAtomic(configPath, merged);
}

// ─── unsetConfigValue ─────────────────────────────────────────────────────────

/**
 * Unset (delete) a dot-path config value and persist it.
 * Uses JSON Merge Patch null convention.
 */
export async function unsetConfigValue(
    dotPath: string,
    opts: ConfigIoOptions = {},
): Promise<WriteConfigFileResult> {
    return setConfigValue(dotPath, null, opts);
}

// ─── writeConfigFile ──────────────────────────────────────────────────────────

/**
 * Write an entire config object to disk.
 * Primary API used by mcp-config.ts set/unset operations.
 */
export async function writeConfigFile(
    config: CoreBlowConfig,
    opts: ConfigIoOptions = {},
): Promise<WriteConfigFileResult & { path: string }> {
    const configPath = resolveWritableConfigPath(opts);
    const result = writeConfigFileAtomic(configPath, config);
    return { ...result, path: configPath };
}
