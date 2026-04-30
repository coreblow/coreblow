/**
 * src/plugins/sandbox.ts
 * Plugin sandbox — isolated execution with permission enforcement
 * SUPERIOR: CoreBlow doesn't sandbox plugins; CoreBlow enforces declared permissions
 */

import { createChildLogger } from '../utils/logger.js';
import type { PluginManifest } from './manifest.js';

const log = createChildLogger('plugin:sandbox');

// ─── Types ────────────────────────────────────────────────────────

export type Permission = 'network' | 'filesystem' | 'exec' | 'env' | 'secrets';

export interface SandboxConfig {
    /** Allowed permissions from manifest */
    permissions: Permission[];
    /** Max memory in MB (0 = unlimited) */
    maxMemoryMB?: number;
    /** Max execution time in ms (0 = unlimited) */
    maxTimeMs?: number;
    /** Plugin name for logging */
    pluginName: string;
}

export interface SandboxedAPI {
    /** Safe fetch — only if 'network' permission */
    fetch: typeof globalThis.fetch | (() => never);
    /** Safe fs — only if 'filesystem' permission */
    readFile: (path: string) => string | never;
    writeFile: (path: string, content: string) => void | never;
    /** Safe exec — only if 'exec' permission */
    exec: (cmd: string) => Promise<string> | never;
    /** Safe env — only if 'env' permission */
    getEnv: (key: string) => string | undefined | never;
    /** Safe secrets — only if 'secrets' permission */
    getSecret: (key: string) => string | undefined | never;
    /** Logging (always allowed) */
    log: { info: Function; warn: Function; error: Function; debug: Function };
    /** KV store (always allowed, scoped to plugin) */
    store: { get: (key: string) => unknown; set: (key: string, value: unknown) => void; delete: (key: string) => void };
}

// ─── Sandbox ─────────────────────────────────────────────────────

export class PluginSandbox {
    private config: SandboxConfig;
    private store = new Map<string, unknown>();
    private violations: { permission: Permission; action: string; timestamp: number }[] = [];

    constructor(config: SandboxConfig) {
        this.config = config;
    }

    /**
     * Create sandbox from a manifest
     */
    static fromManifest(manifest: PluginManifest): PluginSandbox {
        return new PluginSandbox({
            pluginName: manifest.name ?? manifest.id,
            permissions: (manifest as any).permissions ?? [],
        });
    }

    /**
     * Check if a permission is granted
     */
    hasPermission(permission: Permission): boolean {
        return this.config.permissions.includes(permission);
    }

    /**
     * Record a permission violation
     */
    private deny(permission: Permission, action: string): never {
        this.violations.push({ permission, action, timestamp: Date.now() });
        log.warn({ plugin: this.config.pluginName, permission, action }, 'Permission denied');
        throw new Error(`Plugin "${this.config.pluginName}" denied: requires "${permission}" permission for ${action}`);
    }

    /**
     * Create a sandboxed API object for the plugin
     */
    createAPI(secretsProvider?: (key: string) => string | undefined): SandboxedAPI {
        const pluginLog = createChildLogger(`plugin:${this.config.pluginName}`);

        return {
            // Network
            fetch: this.hasPermission('network')
                ? globalThis.fetch.bind(globalThis)
                : () => this.deny('network', 'fetch'),

            // Filesystem
            readFile: this.hasPermission('filesystem')
                ? (p: string) => {
                    const fs = require('node:fs');
                    return fs.readFileSync(p, 'utf-8');
                }
                : () => this.deny('filesystem', 'readFile'),

            writeFile: this.hasPermission('filesystem')
                ? (p: string, content: string) => {
                    const fs = require('node:fs');
                    fs.writeFileSync(p, content);
                }
                : () => this.deny('filesystem', 'writeFile'),

            // Exec
            exec: this.hasPermission('exec')
                ? async (cmd: string) => {
                    const { execSync } = require('node:child_process');
                    return execSync(cmd, { encoding: 'utf-8', timeout: this.config.maxTimeMs || 30000 });
                }
                : () => this.deny('exec', 'exec'),

            // Environment
            getEnv: this.hasPermission('env')
                ? (key: string) => process.env[key]
                : () => this.deny('env', 'getEnv'),

            // Secrets
            getSecret: this.hasPermission('secrets')
                ? (key: string) => secretsProvider?.(key)
                : () => this.deny('secrets', 'getSecret'),

            // Logger (always allowed)
            log: {
                info: pluginLog.info.bind(pluginLog),
                warn: pluginLog.warn.bind(pluginLog),
                error: pluginLog.error.bind(pluginLog),
                debug: pluginLog.debug.bind(pluginLog),
            },

            // KV Store (always allowed, scoped)
            store: {
                get: (key: string) => this.store.get(key),
                set: (key: string, value: unknown) => this.store.set(key, value),
                delete: (key: string) => this.store.delete(key),
            },
        };
    }

    /**
     * Get violation history
     */
    getViolations(): typeof this.violations {
        return [...this.violations];
    }

    /**
     * Get sandbox info
     */
    getInfo(): { pluginName: string; permissions: Permission[]; violations: number; storeSize: number } {
        return {
            pluginName: this.config.pluginName,
            permissions: this.config.permissions,
            violations: this.violations.length,
            storeSize: this.store.size,
        };
    }
}
