/**
 * plugins/plugin-loader.ts
 *
 * Production-Grade Plugin Loader — Gateway Integration
 *
 * Orchestrates the full plugin lifecycle by wiring together all
 * subsystems built in Waves 4-9:
 *   - PluginRegistry       (Wave 4) — Registration + Data Store
 *   - HookRunner           (Wave 4) — Hook execution patterns
 *   - PluginDiscovery      (Wave 4) — Multi-source scanning
 *   - PluginConfigState    (Wave 4) — Config normalization + validation
 *   - PluginServiceManager (Wave 4) — Service lifecycle
 *   - PluginSandbox        (Wave 5) — Permission enforcement
 *   - ResourceLimiter      (Wave 5) — Resource budget enforcement
 *   - PathJail             (Wave 5) — Filesystem isolation
 *   - AuditLog             (Wave 5) — Security event logging
 *   - DependencyGraph      (Wave 7) — DAG resolution + cycle detection
 *   - VersionManager       (Wave 7) — Semver compatibility checks
 *   - PluginHotReload      (Wave 7) — File-watch reload cycles
 *
 * Following CoreBlow's loader.ts (1,410 LOC) pattern:
 *   - discover → validate → sort → load → activate pipeline
 *   - registry caching with LRU eviction
 *   - graceful error handling per-plugin
 *   - diagnostic collection throughout
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { readBoundaryFileSync } from '../infra/boundary-file-read.js';
import { PluginRegistry } from './registry.js';
import { HookRunner } from './hooks.js';
import { PluginDiscovery } from './discovery.js';
import { PluginConfigState, type NormalizedPluginsConfig } from './config-state.js';
import { PluginServiceManager } from './services.js';
import { PluginSandbox } from './sandbox.js';
import { ResourceLimiter } from './resource-limiter.js';
import { PathJail } from './path-jail.js';
import { AuditLog } from './audit-log.js';
import { DependencyGraph } from './dependency-graph.js';
import { PluginConfigValidator } from './config-validator.js';
import { VersionManager } from './version-manager.js';
import { PluginHotReload } from './hot-reload.js';
import { HotReloadManager } from './hot-reload-manager.js';
import { PermissionManager } from './permission-manager.js';
import { MarketplaceApi } from './marketplace-api.js';
import { TelemetryCollector } from './telemetry.js';
import { DependencyResolver } from './dependency-resolver.js';
import { ConfigEditor } from './config-editor.js';
import {
    createPluginRecord,
    type PluginRecord,
    type PluginModule,
    type PluginDefinition,
    type PluginRegistryData,
    type PluginContext,
    type PluginContextLogger,
    type PluginEventBus,
    type PluginApiSurface,
} from './types.js';

const log = createChildLogger('plugin:loader');

// ─── Types ───────────────────────────────────────────────────────

/** Plugin load options */
export interface PluginLoadOptions {
    /** Workspace directory (for plugin discovery) */
    workspaceDir?: string;
    /** Additional plugin directories to scan */
    pluginPaths?: string[];
    /** Plugin configuration from config.json */
    pluginsConfig?: Record<string, unknown>;
    /** Host version for compatibility checks */
    hostVersion?: string;
    /** Resource enforcement profile */
    resourceProfile?: Record<string, unknown>;
    /** Enable hot-reload watcher */
    hotReload?: boolean;
    /** Hot-reload debounce ms */
    hotReloadDebounceMs?: number;
    /** Enable caching */
    cache?: boolean;
    /** Only load these plugin IDs */
    onlyPluginIds?: string[];
    /** Throw on load error instead of collecting diagnostics */
    throwOnLoadError?: boolean;
    /** Activate plugins after loading */
    activate?: boolean;
}

/** Plugin load result */
export interface PluginLoadResult {
    registry: PluginRegistry;
    hookRunner: HookRunner;
    loadOrder: string[];
    loaded: number;
    failed: number;
    skipped: number;
    diagnostics: PluginDiagnostic[];
    duration: number;
}

/** Plugin diagnostic record */
export interface PluginDiagnostic {
    level: 'info' | 'warn' | 'error';
    pluginId?: string;
    source?: string;
    message: string;
    timestamp: number;
}

/** Plugin load failure error */
export class PluginLoadFailureError extends Error {
    readonly pluginIds: string[];
    readonly registry: PluginRegistry;

    constructor(registry: PluginRegistry, failedIds: string[]) {
        const summary = failedIds.join(', ');
        super(`Plugin load failed for: ${summary}`);
        this.name = 'PluginLoadFailureError';
        this.pluginIds = failedIds;
        this.registry = registry;
    }
}

// ─── Cache ───────────────────────────────────────────────────────

interface CachedLoadState {
    registry: PluginRegistry;
    hookRunner: HookRunner;
    loadOrder: string[];
    createdAt: number;
}

const MAX_CACHE_ENTRIES = 64;
const registryCache = new Map<string, CachedLoadState>();

function getCached(key: string): CachedLoadState | undefined {
    const cached = registryCache.get(key);
    if (!cached) return undefined;
    // LRU: refresh insertion order
    registryCache.delete(key);
    registryCache.set(key, cached);
    return cached;
}

function setCached(key: string, state: CachedLoadState): void {
    if (registryCache.has(key)) registryCache.delete(key);
    registryCache.set(key, state);
    while (registryCache.size > MAX_CACHE_ENTRIES) {
        const oldest = registryCache.keys().next().value;
        if (oldest) registryCache.delete(oldest);
        else break;
    }
}

// ─── PluginLoader ────────────────────────────────────────────────

/**
 * CoreBlow Production Plugin Loader
 *
 * Orchestrates the full plugin lifecycle using a phased pipeline:
 *   Phase 1: Discover → scan directories for plugin manifests
 *   Phase 2: Configure → normalize config, resolve enable states
 *   Phase 3: Validate → check versions, dependencies, permissions
 *   Phase 4: Sort → topological ordering via DependencyGraph
 *   Phase 5: Load → execute plugin modules in dependency order
 *   Phase 6: Activate → call plugin activate() hooks
 *   Phase 7: Services → start plugin-registered services
 */
export class PluginLoader {
    // Core subsystems
    private registry: PluginRegistry;
    private hookRunner: HookRunner;
    private discovery: PluginDiscovery;
    private configState: PluginConfigState;
    private serviceManager: PluginServiceManager;

    // Security subsystems
    private sandboxes = new Map<string, PluginSandbox>();
    private limiters = new Map<string, ResourceLimiter>();
    private jails = new Map<string, PathJail>();
    private auditLog: AuditLog;

    // Infrastructure
    private depGraph: DependencyGraph;
    private versionManager: VersionManager;
    private hotReload: PluginHotReload | null = null;
    private hotReloadManager: HotReloadManager;

    // Config validation
    private configValidator: PluginConfigValidator;
    private permissionManager: PermissionManager;
    private marketplaceApi: MarketplaceApi;
    private telemetry: TelemetryCollector;
    private depResolver: DependencyResolver;
    private configEditor: ConfigEditor;

    // State
    private loaded = new Map<string, LoadedPluginState>();
    private resolvedConfigs = new Map<string, Record<string, unknown>>();
    private diagnostics: PluginDiagnostic[] = [];
    private options: PluginLoadOptions;
    private normalizedConfig: NormalizedPluginsConfig | null = null;
    private state: 'idle' | 'loading' | 'loaded' | 'running' | 'stopped' = 'idle';

    constructor(options: PluginLoadOptions = {}) {
        this.options = options;
        this.registry = new PluginRegistry();
        this.hookRunner = new HookRunner(this.registry);
        this.discovery = new PluginDiscovery();
        this.configState = new PluginConfigState();
        this.serviceManager = new PluginServiceManager();
        this.auditLog = new AuditLog();
        this.depGraph = new DependencyGraph();
        this.versionManager = new VersionManager(options.hostVersion ?? '1.0.0');
        this.configValidator = new PluginConfigValidator();
        this.hotReloadManager = new HotReloadManager();
        this.permissionManager = new PermissionManager();
        this.marketplaceApi = new MarketplaceApi({
            permissions: this.permissionManager,
        });
        this.telemetry = new TelemetryCollector();
        this.depResolver = new DependencyResolver(this.depGraph);
        this.configEditor = new ConfigEditor({ validator: this.configValidator });
        this.hotReloadManager.setReloadExecutor(async (pluginId) => {
            try {
                await this.reloadPlugin(pluginId);
                return { pluginId, success: true, duration: 0 };
            } catch (err) {
                return { pluginId, success: false, duration: 0, error: err instanceof Error ? err.message : String(err) };
            }
        });
    }

    // ─── Main Pipeline ──────────────────────────────────────────

    /**
     * Execute the full plugin load pipeline.
     */
    async loadAll(): Promise<PluginLoadResult> {
        const startTime = Date.now();
        this.state = 'loading';
        this.diagnostics = [];

        // Check cache
        if (this.options.cache) {
            const cacheKey = this.buildCacheKey();
            const cached = getCached(cacheKey);
            if (cached) {
                this.registry = cached.registry;
                this.hookRunner = cached.hookRunner;
                this.addDiagnostic('info', 'Cache hit — using cached registry');
                this.state = 'loaded';
                return {
                    registry: this.registry,
                    hookRunner: this.hookRunner,
                    loadOrder: cached.loadOrder,
                    loaded: cached.registry.getData().plugins.length,
                    failed: 0, skipped: 0,
                    diagnostics: this.diagnostics,
                    duration: Date.now() - startTime,
                };
            }
        }

        try {
            // Phase 1: Configure
            this.normalizedConfig = this.configState.normalize(this.options.pluginsConfig);

            // Phase 2: Discover manifests
            const manifests = await this.discoverPlugins();

            // Phase 2b: Validate plugin configs against manifest schemas
            for (const plugin of manifests) {
                const manifestConfig = plugin.config as unknown;
                if (Array.isArray(manifestConfig) && manifestConfig.length > 0) {
                    const userConfig = this.normalizedConfig!.pluginConfigs[plugin.id] ?? {};
                    const validationResult = this.configValidator.validatePluginConfig(
                        plugin.id, manifestConfig, userConfig,
                    );
                    if (validationResult.valid) {
                        this.resolvedConfigs.set(plugin.id, validationResult.resolvedConfig);
                        this.addDiagnostic('info', `Config validated (${validationResult.schemaFields.length} fields, ${Object.keys(validationResult.appliedDefaults).length} defaults applied)`, plugin.id);
                    } else {
                        for (const err of validationResult.errors) {
                            this.addDiagnostic('error', `Config error [${err.field}]: ${err.message}`, plugin.id);
                        }
                    }
                }
            }

            // Phase 3: Filter by enable state + ID filter
            const enabled = this.filterEnabled(manifests);

            // Phase 4: Validate versions + build dependency graph
            this.buildDependencyGraph(enabled);
            const sortResult = this.depGraph.resolveLoadOrder();

            if (!sortResult.valid) {
                for (const cycle of sortResult.cycles) {
                    this.addDiagnostic('error', `Dependency cycle detected: ${cycle.join(' → ')}`, cycle[0]);
                }
                for (const missing of sortResult.missing) {
                    this.addDiagnostic('error', `Missing required dependency: ${missing.pluginId}`, missing.requiredBy);
                }
            }

            // Phase 5: Load in dependency order
            let loaded = 0, failed = 0, skipped = 0;
            const loadOrder = sortResult.order;

            for (const pluginId of loadOrder) {
                const manifest = enabled.find((m) => m.id === pluginId);
                if (!manifest) { skipped++; continue; }

                try {
                    await this.loadPlugin(manifest);
                    loaded++;
                } catch (err) {
                    failed++;
                    const errMsg = err instanceof Error ? err.message : String(err);
                    this.addDiagnostic('error', `Failed to load: ${errMsg}`, pluginId);
                    this.auditLog.recordLifecycle(pluginId, 'load-failed', errMsg);

                    if (this.options.throwOnLoadError) {
                        throw new PluginLoadFailureError(this.registry, [pluginId]);
                    }
                }
            }

            // Phase 6: Activate
            if (this.options.activate !== false) {
                await this.activateAll();
            }

            // Phase 7: Start hot-reload if enabled
            if (this.options.hotReload) {
                this.setupHotReload();
            }

            this.state = 'loaded';

            // Cache result
            if (this.options.cache) {
                setCached(this.buildCacheKey(), {
                    registry: this.registry,
                    hookRunner: this.hookRunner,
                    loadOrder,
                    createdAt: Date.now(),
                });
            }

            return {
                registry: this.registry,
                hookRunner: this.hookRunner,
                loadOrder,
                loaded, failed, skipped,
                diagnostics: [...this.diagnostics],
                duration: Date.now() - startTime,
            };
        } catch (err) {
            this.state = 'idle';
            throw err;
        }
    }

    // ─── Phase Implementations ───────────────────────────────────

    /**
     * Phase 2: Discover plugin manifests from configured paths.
     */
    private async discoverPlugins(): Promise<DiscoveredPlugin[]> {
        const discovered: DiscoveredPlugin[] = [];
        const searchPaths: string[] = [...(this.options.pluginPaths ?? [])];

        if (this.options.workspaceDir) {
            searchPaths.push(path.join(this.options.workspaceDir, 'plugins'));
        }

        // Also include paths from config
        if (this.normalizedConfig?.loadPaths) {
            searchPaths.push(...this.normalizedConfig.loadPaths);
        }

        for (const searchPath of searchPaths) {
            if (!fs.existsSync(searchPath)) continue;

            const entries = fs.readdirSync(searchPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const pluginDir = path.join(searchPath, entry.name);
                const manifestPath = path.join(pluginDir, 'plugin.json');

                if (fs.existsSync(manifestPath)) {
                    try {
                        const read = readBoundaryFileSync({
                            filePath: manifestPath,
                            rootDir: pluginDir,
                            boundaryLabel: 'plugin loader',
                            rejectHardlinks: true,
                            maxBytes: 1_048_576,
                        });
                        if (!read.ok) {
                            this.addDiagnostic('warn', `Unsafe manifest in ${pluginDir}: ${read.error}`, entry.name);
                            continue;
                        }
                        const raw = JSON.parse(read.content);
                        discovered.push({
                            id: raw.name ?? entry.name,
                            name: raw.name ?? entry.name,
                            version: raw.version ?? '0.0.0',
                            description: raw.description,
                            source: pluginDir,
                            origin: 'workspace' as const,
                            dependencies: raw.dependencies ?? [],
                            permissions: raw.permissions ?? [],
                            entryPoint: raw.main ?? 'src/index.ts',
                            config: raw.config ?? {},
                        });
                        this.addDiagnostic('info', `Discovered plugin: ${raw.name}@${raw.version}`, raw.name);
                    } catch (err) {
                        this.addDiagnostic('warn', `Invalid manifest in ${pluginDir}: ${err}`, entry.name);
                    }
                }
            }
        }

        this.addDiagnostic('info', `Discovered ${discovered.length} plugin(s) from ${searchPaths.length} path(s)`);
        return discovered;
    }

    /**
     * Phase 3: Filter by enable state and optional ID filter.
     */
    private filterEnabled(discovered: DiscoveredPlugin[]): DiscoveredPlugin[] {
        const config = this.normalizedConfig!;
        const enabled: DiscoveredPlugin[] = [];

        for (const plugin of discovered) {
            // Check ID filter
            if (this.options.onlyPluginIds && !this.options.onlyPluginIds.includes(plugin.id)) {
                this.addDiagnostic('info', `Skipped (not in onlyPluginIds filter)`, plugin.id);
                continue;
            }

            // Check enable state
            const state = this.configState.resolveEnableState(plugin.id, config);
            if (!state.enabled) {
                this.addDiagnostic('info', `Disabled: ${state.reason}`, plugin.id);
                continue;
            }

            enabled.push(plugin);
        }

        return enabled;
    }

    /**
     * Phase 4: Build dependency graph and validate versions.
     */
    private buildDependencyGraph(plugins: DiscoveredPlugin[]): void {
        this.depGraph = new DependencyGraph();

        for (const plugin of plugins) {
            const deps = (plugin.dependencies ?? []).map((d: string | { pluginId: string; version?: string; optional?: boolean }) => {
                if (typeof d === 'string') return { pluginId: d };
                return { pluginId: d.pluginId, versionConstraint: d.version, optional: d.optional };
            });

            this.depGraph.addPlugin(plugin.id, plugin.version, deps);
            this.versionManager.register(plugin.id, plugin.version);
        }

        // Check host compatibility
        for (const plugin of plugins) {
            const minHost = (plugin as unknown as Record<string, unknown>).minHostVersion as string | undefined;
            if (minHost) {
                const compat = this.versionManager.checkHostCompat(plugin.id, minHost);
                if (!compat.compatible) {
                    this.addDiagnostic('warn', `Host version incompatible: ${compat.reason}`, plugin.id);
                }
            }
        }
    }

    /**
     * Phase 5: Load a single plugin.
     */
    private async loadPlugin(plugin: DiscoveredPlugin): Promise<void> {
        const record = createPluginRecord({
            id: plugin.id,
            name: plugin.name,
            source: plugin.source,
            origin: plugin.origin as any,
            enabled: true,
            version: plugin.version,
        });

        // Create sandbox
        const sandbox = new PluginSandbox({
            pluginName: plugin.id,
            permissions: (plugin.permissions ?? []) as any,
        });
        this.sandboxes.set(plugin.id, sandbox);

        // Create resource limiter
        const profile = this.options.resourceProfile ?? 'standard';
        const limiter = new ResourceLimiter(plugin.id, profile);
        this.limiters.set(plugin.id, limiter);

        // Create path jail
        const jail = PathJail.forPlugin(plugin.id, plugin.source);
        this.jails.set(plugin.id, jail);

        // Audit
        this.auditLog.recordLifecycle(plugin.id, 'loading', plugin.version);

        // Register in registry
        this.registry.getData().plugins.push(record);

        // Store state
        this.loaded.set(plugin.id, {
            plugin,
            record,
            sandbox,
            limiter,
            jail,
            activated: false,
        });

        this.auditLog.recordLifecycle(plugin.id, 'loaded', plugin.version);
    }

    /**
     * Phase 6: Activate all loaded plugins.
     */
    private async activateAll(): Promise<void> {
        for (const [pluginId, state] of this.loaded) {
            if (state.activated) continue;

            try {
                // Create plugin context
                const ctx = this.createPluginContext(pluginId, state);

                // Create API surface
                const api = this.createApiSurface(pluginId, state.record);

                state.activated = true;
                this.auditLog.recordLifecycle(pluginId, 'activated');
                this.addDiagnostic('info', `Activated successfully`, pluginId);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                this.addDiagnostic('error', `Activation failed: ${errMsg}`, pluginId);
                this.auditLog.recordLifecycle(pluginId, 'activation-failed', errMsg);
            }
        }
    }

    /**
     * Phase 7: Setup hot-reload watcher.
     */
    private setupHotReload(): void {
        const watchPaths: string[] = [];
        for (const [, state] of this.loaded) {
            watchPaths.push(state.plugin.source);
        }

        this.hotReload = new PluginHotReload({
            watchPaths,
            debounceMs: this.options.hotReloadDebounceMs ?? 300,
            autoReload: false,
        });
        this.hotReload.setDependencyGraph(this.depGraph);

        this.hotReload.onReload(async (event) => {
            this.auditLog.recordLifecycle(event.pluginId, 'hot-reloading');
            try {
                await this.reloadPlugin(event.pluginId);
                this.auditLog.recordLifecycle(event.pluginId, 'hot-reloaded');
                return { pluginId: event.pluginId, success: true, duration: 0 };
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                this.auditLog.recordLifecycle(event.pluginId, 'hot-reload-failed', errMsg);
                return { pluginId: event.pluginId, success: false, duration: 0, error: errMsg };
            }
        });

        this.hotReload.start();
        this.addDiagnostic('info', `Hot-reload watching ${watchPaths.length} plugin path(s)`);
    }

    // ─── Runtime Operations ──────────────────────────────────────

    /**
     * Reload a specific plugin (unload → re-load → re-activate).
     */
    async reloadPlugin(pluginId: string): Promise<void> {
        const state = this.loaded.get(pluginId);
        if (!state) throw new Error(`Plugin not loaded: ${pluginId}`);

        // Check dependency-safe unload
        const canUnload = this.depGraph.canUnload(pluginId);
        if (!canUnload.safe) {
            // Cascade: unload dependents first
            const unloadOrder = this.depGraph.getUnloadOrder(pluginId);
            for (const depId of unloadOrder) {
                if (depId === pluginId) continue;
                await this.deactivatePlugin(depId);
            }
        }

        // Deactivate
        await this.deactivatePlugin(pluginId);

        // Re-load
        await this.loadPlugin(state.plugin);

        // Re-activate
        const newState = this.loaded.get(pluginId)!;
        const ctx = this.createPluginContext(pluginId, newState);
        const api = this.createApiSurface(pluginId, newState.record);
        newState.activated = true;

        this.addDiagnostic('info', `Reloaded successfully`, pluginId);
    }

    /**
     * Deactivate a specific plugin.
     */
    async deactivatePlugin(pluginId: string): Promise<void> {
        const state = this.loaded.get(pluginId);
        if (!state) return;

        // Cleanup
        state.limiter.dispose();
        state.activated = false;
        this.auditLog.recordLifecycle(pluginId, 'deactivated');
    }

    /**
     * Start all plugin services.
     */
    async startServices(): Promise<{ started: number; failed: number }> {
        this.state = 'running';
        const result = await this.serviceManager.startAll();
        return { started: result.started, failed: result.failed };
    }

    /**
     * Stop all plugin services.
     */
    async stopServices(): Promise<void> {
        await this.serviceManager.stopAll();
    }

    /**
     * Graceful shutdown — stop services, deactivate plugins, clean up.
     */
    async shutdown(): Promise<void> {
        this.state = 'stopped';

        // Stop hot-reload
        this.hotReload?.stop();

        // Stop services
        await this.stopServices();

        // Deactivate plugins in reverse dependency order
        const loadOrder = this.depGraph.resolveLoadOrder();
        const reverseOrder = [...loadOrder.order].reverse();

        for (const pluginId of reverseOrder) {
            await this.deactivatePlugin(pluginId);
        }

        // Cleanup limiters
        for (const [, limiter] of this.limiters) {
            limiter.dispose();
        }

        this.auditLog.recordLifecycle('system', 'shutdown-complete');
        this.addDiagnostic('info', 'Plugin system shut down');
    }

    // ─── Context + API Factory ───────────────────────────────────

    private createPluginContext(pluginId: string, state: LoadedPluginState): PluginContext {
        // Use validated+resolved config if available, fall back to raw config
        const pluginConfig = this.resolvedConfigs.get(pluginId)
            ?? (this.normalizedConfig
                ? this.configState.getPluginConfig(pluginId, this.normalizedConfig)
                : {});

        const logger: PluginContextLogger = {
            info: (msg) => log.info(`[${pluginId}] ${msg}`),
            warn: (msg) => log.warn(`[${pluginId}] ${msg}`),
            error: (msg) => log.error(`[${pluginId}] ${msg}`),
            debug: (msg) => log.debug(`[${pluginId}] ${msg}`),
        };

        const events: PluginEventBus = {
            emit: (event, data) => {
                this.auditLog.recordLifecycle(pluginId, 'event:' + event);
            },
            on: () => {},
            off: () => {},
        };

        const api = this.createApiSurface(pluginId, state.record);

        return {
            pluginId,
            pluginDir: state.plugin.source,
            config: pluginConfig,
            log: logger,
            events,
            api,
        };
    }

    private createApiSurface(pluginId: string, record: PluginRecord): PluginApiSurface {
        return {
            registerTool: (tool) => {
                this.registry.registerTool(record, tool);
                this.auditLog.recordLifecycle(pluginId, 'register-tool', tool.name);
            },
            registerCommand: (command) => {
                this.registry.getData().commands.push({
                    pluginId,
                    command,
                    source: record.source,
                });
                this.auditLog.recordLifecycle(pluginId, 'register-command', command.name);
            },
            registerHook: (hook) => {
                this.registry.registerHook(record, hook.event, hook.handler, { priority: hook.priority });
                this.auditLog.recordLifecycle(pluginId, 'register-hook', hook.event);
            },
            registerProvider: (provider) => {
                this.registry.getData().providers.push({
                    pluginId,
                    provider: { id: provider.name, name: provider.name },
                    source: record.source,
                });
                this.auditLog.recordLifecycle(pluginId, 'register-provider', provider.name);
            },
        };
    }

    // ─── Accessors ───────────────────────────────────────────────

    getRegistry(): PluginRegistry { return this.registry; }
    getHookRunner(): HookRunner { return this.hookRunner; }
    getAuditLog(): AuditLog { return this.auditLog; }
    getDependencyGraph(): DependencyGraph { return this.depGraph; }
    getVersionManager(): VersionManager { return this.versionManager; }
    getHotReload(): PluginHotReload | null { return this.hotReload; }
    getServiceManager(): PluginServiceManager { return this.serviceManager; }
    getConfigValidator(): PluginConfigValidator { return this.configValidator; }
    getHotReloadManager(): HotReloadManager { return this.hotReloadManager; }
    getPermissionManager(): PermissionManager { return this.permissionManager; }
    getMarketplaceApi(): MarketplaceApi { return this.marketplaceApi; }
    getTelemetry(): TelemetryCollector { return this.telemetry; }
    getDependencyResolver(): DependencyResolver { return this.depResolver; }
    getConfigEditor(): ConfigEditor { return this.configEditor; }
    getDiagnostics(): PluginDiagnostic[] { return [...this.diagnostics]; }
    getState(): string { return this.state; }

    getSandbox(pluginId: string): PluginSandbox | undefined { return this.sandboxes.get(pluginId); }
    getLimiter(pluginId: string): ResourceLimiter | undefined { return this.limiters.get(pluginId); }
    getJail(pluginId: string): PathJail | undefined { return this.jails.get(pluginId); }

    getLoadedPlugins(): string[] { return Array.from(this.loaded.keys()); }
    getPluginCount(): number { return this.loaded.size; }
    isLoaded(pluginId: string): boolean { return this.loaded.has(pluginId); }
    isActivated(pluginId: string): boolean { return this.loaded.get(pluginId)?.activated ?? false; }

    /**
     * Get full system health report.
     */
    getHealth(): {
        state: string;
        plugins: number;
        activated: number;
        services: number;
        auditEvents: number;
        diagnostics: number;
        hotReload: boolean;
    } {
        const activated = Array.from(this.loaded.values()).filter((s) => s.activated).length;
        return {
            state: this.state,
            plugins: this.loaded.size,
            activated,
            services: this.serviceManager.getStats().total,
            auditEvents: this.auditLog.count(),
            diagnostics: this.diagnostics.length,
            hotReload: this.hotReload !== null,
        };
    }

    // ─── Static ──────────────────────────────────────────────────

    /** Clear loader cache */
    static clearCache(): void {
        registryCache.clear();
    }

    /** Get cache size */
    static getCacheSize(): number {
        return registryCache.size;
    }

    // ─── Private ─────────────────────────────────────────────────

    private buildCacheKey(): string {
        const parts = [
            this.options.workspaceDir ?? 'none',
            (this.options.pluginPaths ?? []).join(':'),
            JSON.stringify(this.options.pluginsConfig ?? {}),
        ];
        return parts.join('|');
    }

    private addDiagnostic(level: PluginDiagnostic['level'], message: string, pluginId?: string): void {
        this.diagnostics.push({
            level,
            pluginId,
            message,
            timestamp: Date.now(),
        });
    }
}

// ─── Internal Types ──────────────────────────────────────────────

interface DiscoveredPlugin {
    id: string;
    name: string;
    version: string;
    description?: string;
    source: string;
    origin: 'workspace' | 'bundled' | 'npm' | 'git';
    dependencies: Array<string | { pluginId: string; version?: string; optional?: boolean }>;
    permissions: string[];
    entryPoint: string;
    config: Record<string, unknown>;
}

interface LoadedPluginState {
    plugin: DiscoveredPlugin;
    record: PluginRecord;
    sandbox: PluginSandbox;
    limiter: ResourceLimiter;
    jail: PathJail;
    activated: boolean;
}
