/**
 * CoreBlow Config Paths
 *
 * Resolves config file paths across different environments (XDG, home dir, project dir).
 * Supports multiple config formats and custom search paths.
 *
 * Equivalent: CoreBlow config/config-paths.ts + config-env-vars.ts (~310 LOC)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:paths');

// ─── Types ────────────────────────────────────────────────────────

export interface ConfigPathResolution {
    configPath: string | null;
    source: 'project' | 'home' | 'xdg' | 'env' | 'none';
    searchedPaths: string[];
    format: 'json' | 'yaml' | 'toml' | 'unknown';
}

export interface ConfigPaths {
    /** Project-level config (./coreblow.json) */
    project: string;
    /** Home directory config (~/.config/coreblow/config.json) */
    home: string;
    /** XDG config ($XDG_CONFIG_HOME/coreblow/config.json) */
    xdg: string;
    /** Data directory for runtime state */
    data: string;
    /** Cache directory */
    cache: string;
    /** Logs directory */
    logs: string;
}

// ─── Constants ────────────────────────────────────────────────────

const CONFIG_FILE_NAMES = [
    'coreblow.json',
    'coreblow.yaml',
    'coreblow.yml',
    '.coreblow.json',
    '.coreblow.yaml',
    '.coreblowrc',
    '.coreblowrc.json',
];

const APP_NAME = 'coreblow';

// ─── Path Resolution ──────────────────────────────────────────────

/**
 * Resolve all standard config paths
 */
export function getConfigPaths(projectDir?: string): ConfigPaths {
    const home = os.homedir();
    const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
    const xdgData = process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share');
    const xdgCache = process.env.XDG_CACHE_HOME ?? path.join(home, '.cache');

    return {
        project: path.join(projectDir ?? process.cwd(), 'coreblow.json'),
        home: path.join(home, `.${APP_NAME}`, 'config.json'),
        xdg: path.join(xdgConfig, APP_NAME, 'config.json'),
        data: path.join(xdgData, APP_NAME),
        cache: path.join(xdgCache, APP_NAME),
        logs: path.join(xdgData, APP_NAME, 'logs'),
    };
}

/**
 * Find the config file by searching standard locations
 */
export function findConfigFile(projectDir?: string): ConfigPathResolution {
    const searchedPaths: string[] = [];
    const cwd = projectDir ?? process.cwd();

    // 1. Check env var
    const envPath = process.env.CB_CONFIG ?? process.env.COREBLOW_CONFIG;
    if (envPath) {
        searchedPaths.push(envPath);
        if (fileExists(envPath)) {
            return { configPath: envPath, source: 'env', searchedPaths, format: detectFormat(envPath) };
        }
    }

    // 2. Check project directory
    for (const name of CONFIG_FILE_NAMES) {
        const filePath = path.join(cwd, name);
        searchedPaths.push(filePath);
        if (fileExists(filePath)) {
            return { configPath: filePath, source: 'project', searchedPaths, format: detectFormat(filePath) };
        }
    }

    // 3. Check home directory
    const paths = getConfigPaths(cwd);
    searchedPaths.push(paths.home);
    if (fileExists(paths.home)) {
        return { configPath: paths.home, source: 'home', searchedPaths, format: 'json' };
    }

    // 4. Check XDG
    searchedPaths.push(paths.xdg);
    if (fileExists(paths.xdg)) {
        return { configPath: paths.xdg, source: 'xdg', searchedPaths, format: 'json' };
    }

    return { configPath: null, source: 'none', searchedPaths, format: 'unknown' };
}

/**
 * Get the default config file path (for writing new configs)
 */
export function getDefaultConfigPath(projectDir?: string): string {
    return path.join(projectDir ?? process.cwd(), 'coreblow.json');
}

/**
 * Ensure a directory exists (create if missing)
 */
export function ensureDirectoryExists(dirPath: string): boolean {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the data directory, creating it if needed
 */
export function getDataDirectory(projectDir?: string): string {
    const paths = getConfigPaths(projectDir);
    ensureDirectoryExists(paths.data);
    return paths.data;
}

/**
 * Get the cache directory, creating it if needed
 */
export function getCacheDirectory(projectDir?: string): string {
    const paths = getConfigPaths(projectDir);
    ensureDirectoryExists(paths.cache);
    return paths.cache;
}

/**
 * Get the logs directory, creating it if needed
 */
export function getLogsDirectory(projectDir?: string): string {
    const paths = getConfigPaths(projectDir);
    ensureDirectoryExists(paths.logs);
    return paths.logs;
}

/**
 * Resolve a path relative to config dir
 */
export function resolveConfigRelative(relativePath: string, configPath?: string): string {
    const configDir = configPath ? path.dirname(configPath) : process.cwd();
    return path.resolve(configDir, relativePath);
}

// ─── Helpers ──────────────────────────────────────────────────────

function fileExists(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

function detectFormat(filePath: string): 'json' | 'yaml' | 'toml' | 'unknown' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.json': return 'json';
        case '.yaml': case '.yml': return 'yaml';
        case '.toml': return 'toml';
        default: return filePath.endsWith('rc') || filePath.endsWith('rc.json') ? 'json' : 'unknown';
    }
}
