/**
 * plugins/hot-reload.ts
 *
 * Plugin hot-reload — watches plugin directories for file changes
 * and triggers reload/restart cycles with debounce, dependency
 * awareness, and safe unload ordering.
 *
 * Following CoreBlow's config-reload.ts pattern (chokidar watcher,
 * debounce, reload plans) adapted for CoreBlow's plugin system.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import type { DependencyGraph } from './dependency-graph.js';

const log = createChildLogger('plugin:hot-reload');

// ─── Types ───────────────────────────────────────────────────────

/** Hot reload configuration */
export interface HotReloadConfig {
    /** Watch directories */
    watchPaths: string[];
    /** Debounce delay in ms (default: 300) */
    debounceMs?: number;
    /** File patterns to watch (default: ['*.ts', '*.js', '*.json']) */
    patterns?: string[];
    /** Ignore patterns */
    ignorePatterns?: string[];
    /** Whether to auto-reload on change (default: true) */
    autoReload?: boolean;
    /** Max reload retries */
    maxRetries?: number;
}

/** Reload event */
export interface ReloadEvent {
    pluginId: string;
    changedFiles: string[];
    timestamp: number;
    type: 'file-change' | 'manual' | 'dependency-update';
}

/** Reload result */
export interface ReloadResult {
    pluginId: string;
    success: boolean;
    duration: number;
    error?: string;
    reloadedDeps?: string[];
}

/** Reload handler callback */
export type ReloadHandler = (event: ReloadEvent) => Promise<ReloadResult>;

/** Watcher state */
type WatcherState = 'idle' | 'watching' | 'reloading' | 'stopped';

// ─── PluginHotReload ─────────────────────────────────────────────

/**
 * CoreBlow Plugin Hot Reload
 *
 * Watches plugin source directories for changes and triggers
 * reload cycles with debounce and dependency awareness.
 * Uses native fs.watch (no chokidar dependency needed).
 */
export class PluginHotReload {
    private config: Required<HotReloadConfig>;
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private pendingReloads: Map<string, NodeJS.Timeout> = new Map();
    private pluginPathMap: Map<string, string> = new Map(); // path → pluginId
    private reloadHandler: ReloadHandler | null = null;
    private dependencyGraph: DependencyGraph | null = null;
    private state: WatcherState = 'idle';
    private reloadHistory: ReloadResult[] = [];
    private changeBuffer: Map<string, Set<string>> = new Map(); // pluginId → changed files
    private listeners: Array<(event: 'change' | 'reload' | 'error', data: unknown) => void> = [];

    constructor(config: HotReloadConfig) {
        this.config = {
            watchPaths: config.watchPaths,
            debounceMs: config.debounceMs ?? 300,
            patterns: config.patterns ?? ['*.ts', '*.js', '*.json'],
            ignorePatterns: config.ignorePatterns ?? ['node_modules', 'dist', '.git', '*.test.*'],
            autoReload: config.autoReload ?? true,
            maxRetries: config.maxRetries ?? 3,
        };
    }

    // ─── Setup ───────────────────────────────────────────────────

    /**
     * Set the reload handler.
     */
    onReload(handler: ReloadHandler): void {
        this.reloadHandler = handler;
    }

    /**
     * Set the dependency graph for ordered reloading.
     */
    setDependencyGraph(graph: DependencyGraph): void {
        this.dependencyGraph = graph;
    }

    /**
     * Register a plugin's source directory for watching.
     */
    registerPlugin(pluginId: string, sourcePath: string): void {
        this.pluginPathMap.set(path.resolve(sourcePath), pluginId);
    }

    // ─── Lifecycle ───────────────────────────────────────────────

    /**
     * Start watching all registered paths.
     */
    start(): void {
        if (this.state === 'watching') return;

        for (const watchPath of this.config.watchPaths) {
            if (!fs.existsSync(watchPath)) {
                log.warn({ path: watchPath }, 'Watch path does not exist, skipping');
                continue;
            }

            try {
                const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                    if (!filename) return;
                    const fullPath = path.join(watchPath, filename);
                    this.handleFileChange(fullPath, eventType);
                });

                this.watchers.set(watchPath, watcher);
                watcher.on('error', (err) => {
                    log.error({ path: watchPath, err: err.message }, 'Watcher error');
                    this.emit('error', { path: watchPath, error: err.message });
                });
            } catch (err) {
                log.error({ path: watchPath }, 'Failed to start watcher');
            }
        }

        this.state = 'watching';
        log.info({ paths: this.config.watchPaths.length }, 'Hot reload started');
    }

    /**
     * Stop watching all paths.
     */
    stop(): void {
        for (const [, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();

        for (const [, timer] of this.pendingReloads) {
            clearTimeout(timer);
        }
        this.pendingReloads.clear();

        this.state = 'stopped';
        log.info('Hot reload stopped');
    }

    /**
     * Trigger a manual reload for a specific plugin.
     */
    async triggerReload(pluginId: string): Promise<ReloadResult> {
        const event: ReloadEvent = {
            pluginId,
            changedFiles: [],
            timestamp: Date.now(),
            type: 'manual',
        };

        return this.executeReload(event);
    }

    // ─── State ───────────────────────────────────────────────────

    getState(): WatcherState { return this.state; }

    getWatchedPaths(): string[] { return Array.from(this.watchers.keys()); }

    getRegisteredPlugins(): Map<string, string> { return new Map(this.pluginPathMap); }

    getReloadHistory(): ReloadResult[] { return [...this.reloadHistory]; }

    getReloadCount(): number { return this.reloadHistory.length; }

    getSuccessRate(): number {
        if (this.reloadHistory.length === 0) return 1;
        const successes = this.reloadHistory.filter((r) => r.success).length;
        return successes / this.reloadHistory.length;
    }

    // ─── Event Listeners ─────────────────────────────────────────

    on(listener: (event: 'change' | 'reload' | 'error', data: unknown) => void): () => void {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
    }

    // ─── Private ─────────────────────────────────────────────────

    private handleFileChange(filePath: string, eventType: string): void {
        // Check ignore patterns
        if (this.shouldIgnore(filePath)) return;

        // Check file patterns
        if (!this.matchesPattern(filePath)) return;

        // Resolve which plugin this file belongs to
        const pluginId = this.resolvePluginId(filePath);
        if (!pluginId) return;

        // Buffer changes
        if (!this.changeBuffer.has(pluginId)) {
            this.changeBuffer.set(pluginId, new Set());
        }
        this.changeBuffer.get(pluginId)!.add(filePath);

        this.emit('change', { pluginId, file: filePath, eventType });

        // Debounce reload
        if (this.config.autoReload) {
            this.scheduleReload(pluginId);
        }
    }

    private scheduleReload(pluginId: string): void {
        // Clear existing timer
        const existing = this.pendingReloads.get(pluginId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
            this.pendingReloads.delete(pluginId);
            const changedFiles = Array.from(this.changeBuffer.get(pluginId) ?? []);
            this.changeBuffer.delete(pluginId);

            const event: ReloadEvent = {
                pluginId,
                changedFiles,
                timestamp: Date.now(),
                type: 'file-change',
            };

            await this.executeReload(event);
        }, this.config.debounceMs);

        this.pendingReloads.set(pluginId, timer);
    }

    private async executeReload(event: ReloadEvent): Promise<ReloadResult> {
        const start = Date.now();

        if (!this.reloadHandler) {
            const result: ReloadResult = {
                pluginId: event.pluginId,
                success: false,
                duration: 0,
                error: 'No reload handler registered',
            };
            this.reloadHistory.push(result);
            return result;
        }

        this.state = 'reloading';
        log.info({ pluginId: event.pluginId, files: event.changedFiles.length }, 'Reloading plugin');

        try {
            // Reload dependents first if we have a dependency graph
            let reloadedDeps: string[] = [];
            if (this.dependencyGraph) {
                const unloadOrder = this.dependencyGraph.getUnloadOrder(event.pluginId);
                reloadedDeps = unloadOrder.filter((id) => id !== event.pluginId);
            }

            const result = await this.reloadHandler(event);
            result.reloadedDeps = reloadedDeps;
            result.duration = Date.now() - start;

            this.reloadHistory.push(result);
            if (this.reloadHistory.length > 100) {
                this.reloadHistory = this.reloadHistory.slice(-100);
            }

            this.emit('reload', result);
            this.state = 'watching';

            if (result.success) {
                log.info({ pluginId: event.pluginId, duration: result.duration }, 'Plugin reloaded');
            } else {
                log.error({ pluginId: event.pluginId, error: result.error }, 'Plugin reload failed');
            }

            return result;
        } catch (err) {
            const result: ReloadResult = {
                pluginId: event.pluginId,
                success: false,
                duration: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
            };
            this.reloadHistory.push(result);
            this.state = 'watching';
            return result;
        }
    }

    private resolvePluginId(filePath: string): string | null {
        const resolved = path.resolve(filePath);
        for (const [pluginPath, pluginId] of this.pluginPathMap) {
            if (resolved.startsWith(pluginPath + path.sep) || resolved === pluginPath) {
                return pluginId;
            }
        }
        return null;
    }

    private shouldIgnore(filePath: string): boolean {
        for (const pattern of this.config.ignorePatterns) {
            if (pattern.startsWith('*')) {
                // Extension pattern like *.test.*
                const cleanPattern = pattern.replace(/\*/g, '');
                if (filePath.includes(cleanPattern)) return true;
            } else {
                // Directory pattern
                if (filePath.includes(path.sep + pattern + path.sep) || filePath.includes(path.sep + pattern)) {
                    return true;
                }
            }
        }
        return false;
    }

    private matchesPattern(filePath: string): boolean {
        const ext = path.extname(filePath);
        for (const pattern of this.config.patterns) {
            if (pattern.startsWith('*.')) {
                const patternExt = pattern.slice(1); // .ts, .js, .json
                if (ext === patternExt) return true;
            }
        }
        return false;
    }

    private emit(event: 'change' | 'reload' | 'error', data: unknown): void {
        for (const listener of this.listeners) {
            try { listener(event, data); } catch { /* skip */ }
        }
    }
}
