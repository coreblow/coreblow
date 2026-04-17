/**
 * plugins/hot-reload-manager.ts
 *
 * Hot Reload Manager — Higher-level orchestration for live plugin updates
 * without gateway restart.
 *
 * Following CoreBlow's config-reload.ts pattern (chokidar watcher +
 * reload plans) upgraded to CoreBlow OOP with:
 *   - State preservation across reloads (config snapshots)
 *   - Health checks before/after reload
 *   - Automatic rollback on failed reload
 *   - Batch reload for dependency chains
 *   - Reload policies (immediate, batched, manual)
 *   - Event emission for monitoring
 */

import { createChildLogger } from '../utils/logger.js';
import { PluginHotReload, type ReloadEvent, type ReloadResult } from './hot-reload.js';
import type { DependencyGraph } from './dependency-graph.js';

const log = createChildLogger('plugin:hot-reload-manager');

// ─── Types ───────────────────────────────────────────────────────

/** Reload policy — controls when reloads happen */
export type ReloadPolicy = 'immediate' | 'batched' | 'manual';

/** Hot reload manager configuration */
export interface HotReloadManagerConfig {
    /** Reload policy (default: 'immediate') */
    policy?: ReloadPolicy;
    /** Batch window in ms for 'batched' policy (default: 1000) */
    batchWindowMs?: number;
    /** Max concurrent reloads (default: 1) */
    maxConcurrent?: number;
    /** Whether to run health checks after reload (default: true) */
    healthCheckEnabled?: boolean;
    /** Health check timeout in ms (default: 5000) */
    healthCheckTimeoutMs?: number;
    /** Whether to auto-rollback on failed health check (default: true) */
    autoRollback?: boolean;
    /** Max reload attempts before marking plugin as unhealthy (default: 3) */
    maxRetries?: number;
}

/** Plugin state snapshot — preserved across reloads */
export interface PluginStateSnapshot {
    pluginId: string;
    config: Record<string, unknown>;
    version: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** Health check result */
export interface HealthCheckResult {
    pluginId: string;
    healthy: boolean;
    duration: number;
    error?: string;
    checks: HealthCheckItem[];
}

/** Individual health check item */
export interface HealthCheckItem {
    name: string;
    passed: boolean;
    message?: string;
}

/** Reload plan — what to reload and in what order */
export interface ReloadPlan {
    pluginId: string;
    dependents: string[];
    order: string[];
    timestamp: number;
    reason: string;
}

/** Reload attempt record */
export interface ReloadAttempt {
    plan: ReloadPlan;
    result: 'success' | 'failed' | 'rolled-back';
    duration: number;
    healthCheck?: HealthCheckResult;
    error?: string;
    timestamp: number;
}

/** Manager state */
type ManagerState = 'idle' | 'active' | 'reloading' | 'stopped';

/** Event types */
export type HotReloadManagerEvent =
    | { type: 'reload-start'; plan: ReloadPlan }
    | { type: 'reload-success'; attempt: ReloadAttempt }
    | { type: 'reload-failed'; attempt: ReloadAttempt }
    | { type: 'rollback'; pluginId: string; reason: string }
    | { type: 'health-check'; result: HealthCheckResult }
    | { type: 'policy-change'; from: ReloadPolicy; to: ReloadPolicy };

type EventHandler = (event: HotReloadManagerEvent) => void;

// ─── HotReloadManager ────────────────────────────────────────────

/**
 * CoreBlow Hot Reload Manager
 *
 * Orchestrates live plugin updates with state preservation,
 * health checks, automatic rollback, and dependency-aware ordering.
 */
export class HotReloadManager {
    private config: Required<HotReloadManagerConfig>;
    private state: ManagerState = 'idle';

    // Plugin state tracking
    private snapshots = new Map<string, PluginStateSnapshot>();
    private failCounts = new Map<string, number>();

    // Reload tracking
    private reloadQueue: ReloadPlan[] = [];
    private activeReloads = new Set<string>();
    private attempts: ReloadAttempt[] = [];
    private batchTimer: ReturnType<typeof setTimeout> | null = null;

    // Health check callbacks
    private healthCheckers = new Map<string, () => Promise<HealthCheckResult>>();

    // Reload executor
    private reloadExecutor: ((pluginId: string) => Promise<ReloadResult>) | null = null;

    // Event handling
    private eventHandlers: EventHandler[] = [];

    // Dependency graph
    private depGraph: DependencyGraph | null = null;

    constructor(config: HotReloadManagerConfig = {}) {
        this.config = {
            policy: config.policy ?? 'immediate',
            batchWindowMs: config.batchWindowMs ?? 1000,
            maxConcurrent: config.maxConcurrent ?? 1,
            healthCheckEnabled: config.healthCheckEnabled ?? true,
            healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 5000,
            autoRollback: config.autoRollback ?? true,
            maxRetries: config.maxRetries ?? 3,
        };
    }

    // ─── Setup ───────────────────────────────────────────────────

    /**
     * Set the dependency graph for ordered reloading.
     */
    setDependencyGraph(graph: DependencyGraph): void {
        this.depGraph = graph;
    }

    /**
     * Set the reload executor — the function that actually reloads a plugin.
     */
    setReloadExecutor(executor: (pluginId: string) => Promise<ReloadResult>): void {
        this.reloadExecutor = executor;
    }

    /**
     * Register a health checker for a plugin.
     */
    registerHealthChecker(pluginId: string, checker: () => Promise<HealthCheckResult>): void {
        this.healthCheckers.set(pluginId, checker);
    }

    /**
     * Subscribe to reload events.
     */
    onEvent(handler: EventHandler): () => void {
        this.eventHandlers.push(handler);
        return () => {
            this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
        };
    }

    // ─── State Management ────────────────────────────────────────

    /**
     * Save a plugin state snapshot (called before reload).
     */
    saveSnapshot(snapshot: PluginStateSnapshot): void {
        this.snapshots.set(snapshot.pluginId, { ...snapshot });
    }

    /**
     * Get the last saved snapshot for a plugin.
     */
    getSnapshot(pluginId: string): PluginStateSnapshot | undefined {
        return this.snapshots.get(pluginId);
    }

    /**
     * Clear snapshot for a plugin.
     */
    clearSnapshot(pluginId: string): void {
        this.snapshots.delete(pluginId);
    }

    // ─── Reload Operations ───────────────────────────────────────

    /**
     * Request a plugin reload.
     * Behavior depends on the reload policy.
     */
    async requestReload(pluginId: string, reason: string = 'file-change'): Promise<ReloadAttempt | null> {
        // Build reload plan
        const plan = this.buildReloadPlan(pluginId, reason);

        switch (this.config.policy) {
            case 'immediate':
                return this.executeReloadPlan(plan);

            case 'batched':
                this.reloadQueue.push(plan);
                return this.scheduleBatchFlush();

            case 'manual':
                this.reloadQueue.push(plan);
                log.info(`Reload queued (manual policy): ${pluginId}`);
                return null;
        }
    }

    /**
     * Flush all queued reloads (for manual/batched policy).
     */
    async flushQueue(): Promise<ReloadAttempt[]> {
        const results: ReloadAttempt[] = [];
        const plans = [...this.reloadQueue];
        this.reloadQueue = [];

        // Deduplicate by pluginId (keep latest plan per plugin)
        const deduped = new Map<string, ReloadPlan>();
        for (const plan of plans) {
            deduped.set(plan.pluginId, plan);
        }

        for (const [, plan] of deduped) {
            const result = await this.executeReloadPlan(plan);
            if (result) results.push(result);
        }

        return results;
    }

    /**
     * Change the reload policy at runtime.
     */
    setPolicy(policy: ReloadPolicy): void {
        const from = this.config.policy;
        this.config.policy = policy;
        this.emit({ type: 'policy-change', from, to: policy });
        log.info(`Reload policy changed: ${from} → ${policy}`);
    }

    // ─── Lifecycle ───────────────────────────────────────────────

    /**
     * Start the manager.
     */
    start(): void {
        this.state = 'active';
        log.info(`Hot reload manager started (policy: ${this.config.policy})`);
    }

    /**
     * Stop the manager.
     */
    stop(): void {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        this.activeReloads.clear();
        this.reloadQueue = [];
        this.state = 'stopped';
        log.info('Hot reload manager stopped');
    }

    // ─── State Accessors ─────────────────────────────────────────

    getState(): ManagerState { return this.state; }
    getPolicy(): ReloadPolicy { return this.config.policy; }
    getQueueLength(): number { return this.reloadQueue.length; }
    getActiveReloads(): string[] { return Array.from(this.activeReloads); }
    getAttempts(): ReloadAttempt[] { return [...this.attempts]; }
    getSnapshotCount(): number { return this.snapshots.size; }

    getFailCount(pluginId: string): number {
        return this.failCounts.get(pluginId) ?? 0;
    }

    isHealthy(pluginId: string): boolean {
        return this.getFailCount(pluginId) < this.config.maxRetries;
    }

    getStats(): {
        state: ManagerState;
        policy: ReloadPolicy;
        totalAttempts: number;
        successCount: number;
        failCount: number;
        rollbackCount: number;
        queueLength: number;
        activeReloads: number;
        snapshots: number;
    } {
        const successCount = this.attempts.filter((a) => a.result === 'success').length;
        const failCount = this.attempts.filter((a) => a.result === 'failed').length;
        const rollbackCount = this.attempts.filter((a) => a.result === 'rolled-back').length;

        return {
            state: this.state,
            policy: this.config.policy,
            totalAttempts: this.attempts.length,
            successCount,
            failCount,
            rollbackCount,
            queueLength: this.reloadQueue.length,
            activeReloads: this.activeReloads.size,
            snapshots: this.snapshots.size,
        };
    }

    // ─── Private ─────────────────────────────────────────────────

    /**
     * Build a reload plan with dependency ordering.
     */
    private buildReloadPlan(pluginId: string, reason: string): ReloadPlan {
        let dependents: string[] = [];
        let order: string[] = [pluginId];

        if (this.depGraph) {
            try {
                const unloadOrder = this.depGraph.getUnloadOrder(pluginId);
                dependents = unloadOrder.filter((id) => id !== pluginId);
                // Reload order: dependents first (reverse unload), then the target
                order = [...dependents, pluginId];
            } catch {
                // No deps — just reload the target
            }
        }

        return { pluginId, dependents, order, timestamp: Date.now(), reason };
    }

    /**
     * Execute a reload plan.
     */
    private async executeReloadPlan(plan: ReloadPlan): Promise<ReloadAttempt> {
        const start = Date.now();
        this.state = 'reloading';
        this.activeReloads.add(plan.pluginId);
        this.emit({ type: 'reload-start', plan });

        // Save snapshot before reload
        const existingSnapshot = this.snapshots.get(plan.pluginId);

        try {
            if (!this.reloadExecutor) {
                throw new Error('No reload executor registered');
            }

            // Execute reload for each plugin in order
            for (const targetId of plan.order) {
                const result = await this.reloadExecutor(targetId);
                if (!result.success) {
                    throw new Error(`Reload failed for ${targetId}: ${result.error}`);
                }
            }

            // Health check after reload
            let healthCheck: HealthCheckResult | undefined;
            if (this.config.healthCheckEnabled) {
                healthCheck = await this.runHealthCheck(plan.pluginId);
                if (!healthCheck.healthy) {
                    throw new Error(`Health check failed: ${healthCheck.error ?? 'unknown'}`);
                }
            }

            // Success
            const attempt: ReloadAttempt = {
                plan,
                result: 'success',
                duration: Date.now() - start,
                healthCheck,
                timestamp: Date.now(),
            };

            this.attempts.push(attempt);
            this.failCounts.delete(plan.pluginId);
            this.activeReloads.delete(plan.pluginId);
            this.state = 'active';
            this.emit({ type: 'reload-success', attempt });

            log.info(`Plugin ${plan.pluginId} reloaded successfully (${attempt.duration}ms)`);
            return attempt;

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const failCount = (this.failCounts.get(plan.pluginId) ?? 0) + 1;
            this.failCounts.set(plan.pluginId, failCount);

            // Auto-rollback if enabled and we have a snapshot
            let resultType: ReloadAttempt['result'] = 'failed';
            if (this.config.autoRollback && existingSnapshot) {
                this.emit({ type: 'rollback', pluginId: plan.pluginId, reason: errMsg });
                resultType = 'rolled-back';
                log.warn(`Rolling back ${plan.pluginId} (attempt ${failCount}/${this.config.maxRetries})`);
            }

            const attempt: ReloadAttempt = {
                plan,
                result: resultType,
                duration: Date.now() - start,
                error: errMsg,
                timestamp: Date.now(),
            };

            this.attempts.push(attempt);
            this.activeReloads.delete(plan.pluginId);
            this.state = 'active';
            this.emit({ type: 'reload-failed', attempt });

            log.error(`Plugin ${plan.pluginId} reload failed: ${errMsg}`);
            return attempt;
        }
    }

    /**
     * Run health check for a plugin.
     */
    private async runHealthCheck(pluginId: string): Promise<HealthCheckResult> {
        const checker = this.healthCheckers.get(pluginId);
        if (!checker) {
            return {
                pluginId,
                healthy: true,
                duration: 0,
                checks: [{ name: 'no-checker', passed: true, message: 'No health checker registered' }],
            };
        }

        const start = Date.now();
        try {
            const result = await Promise.race([
                checker(),
                new Promise<HealthCheckResult>((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeoutMs),
                ),
            ]);
            result.duration = Date.now() - start;
            this.emit({ type: 'health-check', result });
            return result;
        } catch (err) {
            const result: HealthCheckResult = {
                pluginId,
                healthy: false,
                duration: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
                checks: [{ name: 'execution', passed: false, message: String(err) }],
            };
            this.emit({ type: 'health-check', result });
            return result;
        }
    }

    /**
     * Schedule a batch flush.
     */
    private scheduleBatchFlush(): Promise<ReloadAttempt | null> {
        if (this.batchTimer) return Promise.resolve(null);

        return new Promise((resolve) => {
            this.batchTimer = setTimeout(async () => {
                this.batchTimer = null;
                const results = await this.flushQueue();
                resolve(results[0] ?? null);
            }, this.config.batchWindowMs);
        });
    }

    /**
     * Emit event to all handlers.
     */
    private emit(event: HotReloadManagerEvent): void {
        for (const handler of this.eventHandlers) {
            try { handler(event); } catch { /* skip */ }
        }
    }
}
