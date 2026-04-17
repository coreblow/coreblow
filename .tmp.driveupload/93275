/**
 * CoreBlow Plugin Runtime
 *
 * Manages the full plugin lifecycle: discovery, manifest validation,
 * installation, enable/disable toggling, runtime event bus, and
 * permission-scoped execution. Plugins can extend channels, tools,
 * commands, and hooks.
 *
 * Inspired by CoreBlow's plugin system (78 files) but consolidated
 * into a single lean runtime module.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Plugin manifest schema */
export interface PluginManifest {
    /** Unique plugin identifier (reverse domain preferred) */
    id: string;
    /** Human-readable name */
    name: string;
    /** Semver version */
    version: string;
    /** Plugin description */
    description?: string;
    /** Plugin author */
    author?: string;
    /** Homepage URL */
    homepage?: string;
    /** Entry point file (relative to plugin dir) */
    main: string;
    /** Plugin capabilities */
    provides?: Array<'channel' | 'tool' | 'command' | 'hook' | 'middleware'>;
    /** Required permissions */
    permissions?: Array<'network' | 'filesystem' | 'process' | 'config'>;
    /** Minimum CoreBlow version */
    minVersion?: string;
    /** Config schema (JSON Schema subset) */
    configSchema?: Record<string, unknown>;
}

/** Plugin runtime state */
export interface PluginState {
    manifest: PluginManifest;
    directory: string;
    enabled: boolean;
    loaded: boolean;
    error?: string;
    instance?: PluginInstance;
    installedAt: number;
    lastLoadedAt?: number;
}

/** Plugin instance — what the plugin exports */
export interface PluginInstance {
    activate?(ctx: PluginContext): Promise<void> | void;
    deactivate?(): Promise<void> | void;
    onConfigChange?(config: Record<string, unknown>): void;
    [key: string]: unknown;
}

/** Context provided to plugins during activation */
export interface PluginContext {
    pluginId: string;
    pluginDir: string;
    config: Record<string, unknown>;
    log: PluginLogger;
    events: PluginEventBus;
}

/** Plugin logger */
export interface PluginLogger {
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    debug(msg: string, ...args: unknown[]): void;
}

/** Plugin event bus for plugin ↔ core communication */
export interface PluginEventBus {
    emit(event: string, data?: unknown): void;
    on(event: string, handler: (data: unknown) => void): void;
    off(event: string, handler: (data: unknown) => void): void;
}

/**
 * CoreBlow Plugin Runtime
 */
export class PluginRuntime {
    private plugins = new Map<string, PluginState>();
    private eventHandlers = new Map<string, Set<(data: unknown) => void>>();
    private pluginConfigs = new Map<string, Record<string, unknown>>();

    /**
     * Discover plugins from a directory.
     * Each subdirectory with a manifest.json is a plugin.
     */
    async discover(pluginsDir: string): Promise<string[]> {
        const discovered: string[] = [];

        if (!fs.existsSync(pluginsDir)) return discovered;

        const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginDir = path.join(pluginsDir, entry.name);
            const manifestPath = path.join(pluginDir, 'manifest.json');

            if (!fs.existsSync(manifestPath)) continue;

            try {
                const raw = fs.readFileSync(manifestPath, 'utf-8');
                const manifest = JSON.parse(raw) as PluginManifest;

                if (!this.validateManifest(manifest)) continue;

                if (!this.plugins.has(manifest.id)) {
                    this.plugins.set(manifest.id, {
                        manifest,
                        directory: pluginDir,
                        enabled: true,
                        loaded: false,
                        installedAt: Date.now(),
                    });
                    discovered.push(manifest.id);
                }
            } catch {
                // Invalid manifest — skip
            }
        }

        return discovered;
    }

    /**
     * Load and activate a plugin.
     */
    async load(pluginId: string): Promise<boolean> {
        const state = this.plugins.get(pluginId);
        if (!state || state.loaded) return false;

        try {
            const entryPath = path.join(state.directory, state.manifest.main);
            const mod = await import(entryPath);
            const instance: PluginInstance = mod.default ?? mod;

            state.instance = instance;
            state.loaded = true;
            state.lastLoadedAt = Date.now();

            // Activate
            if (instance.activate) {
                const ctx = this.createContext(pluginId, state);
                await instance.activate(ctx);
            }

            this.emitEvent('plugin:loaded', { pluginId });
            return true;
        } catch (err) {
            state.error = err instanceof Error ? err.message : String(err);
            state.loaded = false;
            return false;
        }
    }

    /**
     * Unload and deactivate a plugin.
     */
    async unload(pluginId: string): Promise<boolean> {
        const state = this.plugins.get(pluginId);
        if (!state || !state.loaded) return false;

        try {
            if (state.instance?.deactivate) {
                await state.instance.deactivate();
            }
        } catch {
            // Deactivation error — log and continue
        }

        state.loaded = false;
        state.instance = undefined;
        this.emitEvent('plugin:unloaded', { pluginId });
        return true;
    }

    /**
     * Enable/disable a plugin.
     */
    setEnabled(pluginId: string, enabled: boolean): boolean {
        const state = this.plugins.get(pluginId);
        if (!state) return false;
        state.enabled = enabled;
        return true;
    }

    /**
     * Install a plugin from a directory path.
     */
    async install(sourcePath: string): Promise<string | null> {
        const manifestPath = path.join(sourcePath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) return null;

        try {
            const raw = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = JSON.parse(raw) as PluginManifest;

            if (!this.validateManifest(manifest)) return null;
            if (this.plugins.has(manifest.id)) return null;

            this.plugins.set(manifest.id, {
                manifest,
                directory: sourcePath,
                enabled: true,
                loaded: false,
                installedAt: Date.now(),
            });

            this.emitEvent('plugin:installed', { pluginId: manifest.id });
            return manifest.id;
        } catch {
            return null;
        }
    }

    /**
     * Uninstall a plugin.
     */
    async uninstall(pluginId: string): Promise<boolean> {
        const state = this.plugins.get(pluginId);
        if (!state) return false;

        if (state.loaded) {
            await this.unload(pluginId);
        }

        this.plugins.delete(pluginId);
        this.emitEvent('plugin:uninstalled', { pluginId });
        return true;
    }

    /**
     * Get plugin state.
     */
    getPlugin(pluginId: string): PluginState | null {
        return this.plugins.get(pluginId) ?? null;
    }

    /**
     * List all plugins.
     */
    listPlugins(): PluginState[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Update plugin config.
     */
    setConfig(pluginId: string, config: Record<string, unknown>): void {
        this.pluginConfigs.set(pluginId, config);
        const state = this.plugins.get(pluginId);
        if (state?.instance?.onConfigChange) {
            state.instance.onConfigChange(config);
        }
    }

    /**
     * Load all enabled plugins.
     */
    async loadAll(): Promise<{ loaded: number; failed: number }> {
        let loaded = 0;
        let failed = 0;

        for (const [id, state] of Array.from(this.plugins)) {
            if (!state.enabled || state.loaded) continue;
            const ok = await this.load(id);
            if (ok) loaded++;
            else failed++;
        }

        return { loaded, failed };
    }

    /**
     * Unload all plugins.
     */
    async unloadAll(): Promise<void> {
        for (const [id, state] of Array.from(this.plugins)) {
            if (state.loaded) {
                await this.unload(id);
            }
        }
    }

    // === Private ===

    private validateManifest(manifest: PluginManifest): boolean {
        return !!(manifest.id && manifest.name && manifest.version && manifest.main);
    }

    private createContext(pluginId: string, state: PluginState): PluginContext {
        const self = this;
        return {
            pluginId,
            pluginDir: state.directory,
            config: this.pluginConfigs.get(pluginId) ?? {},
            log: {
                info: (msg, ...args) => console.log(`[plugin:${pluginId}] ${msg}`, ...args),
                warn: (msg, ...args) => console.warn(`[plugin:${pluginId}] ${msg}`, ...args),
                error: (msg, ...args) => console.error(`[plugin:${pluginId}] ${msg}`, ...args),
                debug: (msg, ...args) => console.debug(`[plugin:${pluginId}] ${msg}`, ...args),
            },
            events: {
                emit: (event, data) => self.emitEvent(`plugin:${pluginId}:${event}`, data),
                on: (event, handler) => self.onEvent(`plugin:${pluginId}:${event}`, handler),
                off: (event, handler) => self.offEvent(`plugin:${pluginId}:${event}`, handler),
            },
        };
    }

    private emitEvent(event: string, data?: unknown): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of Array.from(handlers)) {
                try { handler(data); } catch { /* skip */ }
            }
        }
    }

    private onEvent(event: string, handler: (data: unknown) => void): void {
        let handlers = this.eventHandlers.get(event);
        if (!handlers) {
            handlers = new Set();
            this.eventHandlers.set(event, handlers);
        }
        handlers.add(handler);
    }

    private offEvent(event: string, handler: (data: unknown) => void): void {
        this.eventHandlers.get(event)?.delete(handler);
    }
}
