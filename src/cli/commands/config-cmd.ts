/**
 * CoreBlow CLI — `coreblow config` command
 *
 * View and modify CoreBlow configuration. Supports get/set/list/path
 * subcommands for direct config manipulation without editing JSON by hand.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ─── Helpers ─────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');

function loadRawConfig(): Record<string, unknown> {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function saveConfig(config: Record<string, unknown>): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Resolve a dot-path (e.g. "providers.openai.apiKey") to its value.
 */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
    const segments = keyPath.split('.');
    let current: unknown = obj;
    for (const seg of segments) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[seg];
    }
    return current;
}

/**
 * Set a dot-path value, creating intermediate objects as needed.
 */
function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
    const segments = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (typeof current[seg] !== 'object' || current[seg] === null) {
            current[seg] = {};
        }
        current = current[seg] as Record<string, unknown>;
    }
    current[segments[segments.length - 1]] = value;
}

/**
 * Delete a dot-path key from an object.
 */
function deleteNestedValue(obj: Record<string, unknown>, keyPath: string): boolean {
    const segments = keyPath.split('.');
    let current: unknown = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        if (typeof current !== 'object' || current === null) return false;
        current = (current as Record<string, unknown>)[segments[i]];
    }
    if (typeof current !== 'object' || current === null) return false;
    const last = segments[segments.length - 1];
    if (last in (current as Record<string, unknown>)) {
        delete (current as Record<string, unknown>)[last];
        return true;
    }
    return false;
}

/**
 * Flatten an object into dot-path key/value pairs for listing.
 */
function flattenConfig(obj: Record<string, unknown>, prefix = ''): Array<{ key: string; value: unknown }> {
    const result: Array<{ key: string; value: unknown }> = [];
    for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            result.push(...flattenConfig(val as Record<string, unknown>, fullKey));
        } else {
            result.push({ key: fullKey, value: val });
        }
    }
    return result;
}

// ─── ANSI helpers ────────────────────────────────────────────────

const dim = '\x1b[2m';
const bold = '\x1b[1m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

// ─── Command Registration ───────────────────────────────────────

export function registerConfigCommand(parent: Command): void {
    const cmd = parent
        .command('config')
        .description('View and modify CoreBlow configuration');

    // coreblow config path — show config file location
    cmd.command('path')
        .description('Show the active config file path')
        .action(() => {
            const exists = fs.existsSync(CONFIG_FILE);
            console.log(`${bold}Config file:${reset} ${CONFIG_FILE}`);
            console.log(`${dim}Status:${reset} ${exists ? `${green}exists${reset}` : `${yellow}not found${reset}`}`);
        });

    // coreblow config list — list all config keys
    cmd.command('list')
        .alias('ls')
        .description('List all configuration values')
        .option('--json', 'Output raw JSON')
        .action((opts: { json?: boolean }) => {
            const config = loadRawConfig();
            if (opts.json) {
                console.log(JSON.stringify(config, null, 2));
                return;
            }
            const entries = flattenConfig(config);
            if (entries.length === 0) {
                console.log(`${dim}No configuration values set.${reset}`);
                console.log(`${dim}Run ${cyan}coreblow onboard${reset}${dim} to get started.${reset}`);
                return;
            }
            console.log(`${bold}CoreBlow Config${reset} ${dim}(${CONFIG_FILE})${reset}\n`);
            const maxKey = Math.max(...entries.map(e => e.key.length), 10);
            for (const { key, value } of entries) {
                const displayValue = typeof value === 'string' && key.toLowerCase().includes('key')
                    ? maskSecret(value)
                    : JSON.stringify(value);
                console.log(`  ${cyan}${key.padEnd(maxKey)}${reset}  ${displayValue}`);
            }
        });

    // coreblow config get <key> — get a single value
    cmd.command('get <key>')
        .description('Get a configuration value by dot-path key')
        .action((key: string) => {
            const config = loadRawConfig();
            const value = getNestedValue(config, key);
            if (value === undefined) {
                console.log(`${yellow}⚠${reset} Key "${key}" not found in config.`);
                process.exitCode = 1;
                return;
            }
            if (typeof value === 'object') {
                console.log(JSON.stringify(value, null, 2));
            } else {
                console.log(String(value));
            }
        });

    // coreblow config set <key> <value> — set a value
    cmd.command('set <key> <value>')
        .description('Set a configuration value (auto-parses booleans/numbers)')
        .action((key: string, rawValue: string) => {
            const config = loadRawConfig();
            const value = parseValue(rawValue);
            setNestedValue(config, key, value);
            saveConfig(config);
            console.log(`${green}✓${reset} Set ${cyan}${key}${reset} = ${JSON.stringify(value)}`);
        });

    // coreblow config delete <key> — delete a key
    cmd.command('delete <key>')
        .alias('rm')
        .description('Delete a configuration key')
        .action((key: string) => {
            const config = loadRawConfig();
            if (deleteNestedValue(config, key)) {
                saveConfig(config);
                console.log(`${green}✓${reset} Deleted ${cyan}${key}${reset}`);
            } else {
                console.log(`${yellow}⚠${reset} Key "${key}" not found.`);
                process.exitCode = 1;
            }
        });

    // coreblow config edit — open config in $EDITOR
    cmd.command('edit')
        .description('Open config file in your default editor')
        .action(() => {
            const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
            if (!fs.existsSync(CONFIG_FILE)) {
                saveConfig({});
                console.log(`${dim}Created empty config at ${CONFIG_FILE}${reset}`);
            }
            const { execSync } = require('node:child_process') as typeof import('node:child_process');
            execSync(`${editor} "${CONFIG_FILE}"`, { stdio: 'inherit' });
        });
}

// ─── Value Parsing ───────────────────────────────────────────────

function parseValue(raw: string): unknown {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    const num = Number(raw);
    if (!Number.isNaN(num) && raw.trim() !== '') return num;
    // Try JSON parse for objects/arrays
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object') return parsed;
    } catch {
        // plain string
    }
    return raw;
}

function maskSecret(value: string): string {
    if (value.length <= 8) return '••••••••';
    return value.slice(0, 4) + '••••' + value.slice(-4);
}
