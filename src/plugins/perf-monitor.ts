/**
 * plugins/perf-monitor.ts
 *
 * Plugin System Performance Monitor
 *
 * Following CoreBlow's observability/plugin-metrics.ts (~400 LOC) +
 * perf/timer.ts (~300 LOC) pattern, consolidated into a single OOP
 * monitor with integrated benchmarking engine and p95/p99 calculations.
 *
 * Tracks performance metrics for the entire plugin lifecycle:
 *   - Plugin discovery + load time
 *   - Hook execution latency (per-hook, per-plugin)
 *   - Message pipeline throughput
 *   - Memory footprint per plugin
 *   - Dependency resolution time
 *   - Sandbox creation overhead
 *
 * Integrates with MetricAggregator for p95/p99 calculations.
 */

import { clamp } from "../utils.js";
import { MetricAggregator, type AggregatedMetric } from '../observability/metric-aggregator.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:perf');

// ─── Types ──────────────────────────────────────────────────────

export interface TimingEntry {
    label: string;
    startMs: number;
    endMs: number;
    durationMs: number;
    metadata?: Record<string, unknown>;
}

export interface PluginPerfSnapshot {
    pluginId: string;
    loadTimeMs: number;
    activateTimeMs: number;
    hookExecutions: number;
    avgHookLatencyMs: number;
    totalHookTimeMs: number;
    memoryEstimateKb: number;
}

export interface PipelinePerfSnapshot {
    messagesProcessed: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    throughputPerSec: number;
    stageBreakdown: Record<string, AggregatedMetric>;
}

export interface SystemPerfReport {
    timestamp: number;
    uptime: number;
    plugins: PluginPerfSnapshot[];
    pipeline: PipelinePerfSnapshot;
    loader: {
        discoveryTimeMs: number;
        dependencyResolutionTimeMs: number;
        totalLoadTimeMs: number;
        sandboxCreationTimeMs: number;
    };
    memory: {
        heapUsedMb: number;
        heapTotalMb: number;
        rssMb: number;
        externalMb: number;
    };
}

export interface BenchmarkResult {
    name: string;
    iterations: number;
    totalMs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    opsPerSec: number;
    p95Ms: number;
    p99Ms: number;
}

// ─── PluginPerfMonitor ──────────────────────────────────────────

/**
 * PluginPerfMonitor
 *
 * Centralized performance tracking for the plugin system.
 * Records timing for all phases and computes aggregated metrics.
 */
export class PluginPerfMonitor {
    private aggregator: MetricAggregator;
    private timings: TimingEntry[] = [];
    private pluginTimings = new Map<string, { loadMs: number; activateMs: number }>();
    private hookLatencies = new Map<string, number[]>();
    private pipelineLatencies: number[] = [];
    private stageLatencies = new Map<string, number[]>();
    private startedAt: number;
    private maxTimings = 10_000;

    constructor(aggregator?: MetricAggregator) {
        this.aggregator = aggregator ?? new MetricAggregator();
        this.startedAt = Date.now();
    }

    // ─── Timing Helpers ─────────────────────────────────────────

    /**
     * Start a timer. Returns a stop function that records the timing.
     */
    startTimer(label: string, metadata?: Record<string, unknown>): () => number {
        const startMs = performance.now();
        return () => {
            const endMs = performance.now();
            const durationMs = endMs - startMs;
            this.recordTiming({ label, startMs, endMs, durationMs, metadata });
            return durationMs;
        };
    }

    /**
     * Measure an async function's execution time.
     */
    async measure<T>(label: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<{ result: T; durationMs: number }> {
        const stop = this.startTimer(label, metadata);
        const result = await fn();
        const durationMs = stop();
        return { result, durationMs };
    }

    /**
     * Measure a sync function's execution time.
     */
    measureSync<T>(label: string, fn: () => T, metadata?: Record<string, unknown>): { result: T; durationMs: number } {
        const stop = this.startTimer(label, metadata);
        const result = fn();
        const durationMs = stop();
        return { result, durationMs };
    }

    // ─── Plugin Lifecycle ───────────────────────────────────────

    /**
     * Record plugin load time.
     */
    recordPluginLoad(pluginId: string, durationMs: number): void {
        const existing = this.pluginTimings.get(pluginId) ?? { loadMs: 0, activateMs: 0 };
        existing.loadMs = durationMs;
        this.pluginTimings.set(pluginId, existing);
        this.aggregator.record('plugin.load', durationMs, { pluginId });
    }

    /**
     * Record plugin activation time.
     */
    recordPluginActivate(pluginId: string, durationMs: number): void {
        const existing = this.pluginTimings.get(pluginId) ?? { loadMs: 0, activateMs: 0 };
        existing.activateMs = durationMs;
        this.pluginTimings.set(pluginId, existing);
        this.aggregator.record('plugin.activate', durationMs, { pluginId });
    }

    // ─── Hook Execution ─────────────────────────────────────────

    /**
     * Record hook execution latency.
     */
    recordHookExecution(hookName: string, pluginId: string, durationMs: number): void {
        const key = `${pluginId}:${hookName}`;
        const list = this.hookLatencies.get(key) ?? [];
        list.push(durationMs);
        this.hookLatencies.set(key, list);
        this.aggregator.record('hook.execution', durationMs, { hookName, pluginId });
    }

    // ─── Pipeline ───────────────────────────────────────────────

    /**
     * Record message pipeline latency.
     */
    recordPipelineLatency(durationMs: number, stage?: string): void {
        this.pipelineLatencies.push(durationMs);
        this.aggregator.record('pipeline.latency', durationMs);

        if (stage) {
            const list = this.stageLatencies.get(stage) ?? [];
            list.push(durationMs);
            this.stageLatencies.set(stage, list);
            this.aggregator.record(`pipeline.stage.${stage}`, durationMs);
        }
    }

    // ─── Loader Phases ──────────────────────────────────────────

    /**
     * Record loader phase timing.
     */
    recordLoaderPhase(phase: string, durationMs: number): void {
        this.aggregator.record(`loader.${phase}`, durationMs);
        this.recordTiming({ label: `loader.${phase}`, startMs: 0, endMs: 0, durationMs });
    }

    // ─── Snapshots & Reports ────────────────────────────────────

    /**
     * Get per-plugin performance snapshot.
     */
    getPluginSnapshots(): PluginPerfSnapshot[] {
        const snapshots: PluginPerfSnapshot[] = [];

        for (const [pluginId, timing] of this.pluginTimings) {
            let totalHookTime = 0;
            let hookExecutions = 0;

            for (const [key, latencies] of this.hookLatencies) {
                if (key.startsWith(`${pluginId}:`)) {
                    totalHookTime += latencies.reduce((a, b) => a + b, 0);
                    hookExecutions += latencies.length;
                }
            }

            snapshots.push({
                pluginId,
                loadTimeMs: timing.loadMs,
                activateTimeMs: timing.activateMs,
                hookExecutions,
                avgHookLatencyMs: hookExecutions > 0 ? totalHookTime / hookExecutions : 0,
                totalHookTimeMs: totalHookTime,
                memoryEstimateKb: 0, // Would require v8.getHeapSnapshot in production
            });
        }

        return snapshots;
    }

    /**
     * Get pipeline performance snapshot.
     */
    getPipelineSnapshot(): PipelinePerfSnapshot {
        const latencies = [...this.pipelineLatencies];
        const count = latencies.length;

        if (count === 0) {
            return {
                messagesProcessed: 0,
                avgLatencyMs: 0,
                p95LatencyMs: 0,
                p99LatencyMs: 0,
                minLatencyMs: 0,
                maxLatencyMs: 0,
                throughputPerSec: 0,
                stageBreakdown: {},
            };
        }

        latencies.sort((a, b) => a - b);
        const sum = latencies.reduce((a, b) => a + b, 0);
        const uptimeSec = (Date.now() - this.startedAt) / 1000;

        const stageBreakdown: Record<string, AggregatedMetric> = {};
        for (const stage of this.stageLatencies.keys()) {
            stageBreakdown[stage] = this.aggregator.aggregate(`pipeline.stage.${stage}`, 3_600_000);
        }

        return {
            messagesProcessed: count,
            avgLatencyMs: round(sum / count),
            p95LatencyMs: round(percentile(latencies, 0.95)),
            p99LatencyMs: round(percentile(latencies, 0.99)),
            minLatencyMs: round(latencies[0]),
            maxLatencyMs: round(latencies[count - 1]),
            throughputPerSec: uptimeSec > 0 ? round(count / uptimeSec) : 0,
            stageBreakdown,
        };
    }

    /**
     * Get full system performance report.
     */
    getReport(): SystemPerfReport {
        const memory = process.memoryUsage();
        const loaderTimings = this.getLoaderTimings();

        return {
            timestamp: Date.now(),
            uptime: Date.now() - this.startedAt,
            plugins: this.getPluginSnapshots(),
            pipeline: this.getPipelineSnapshot(),
            loader: loaderTimings,
            memory: {
                heapUsedMb: round(memory.heapUsed / 1024 / 1024),
                heapTotalMb: round(memory.heapTotal / 1024 / 1024),
                rssMb: round(memory.rss / 1024 / 1024),
                externalMb: round(memory.external / 1024 / 1024),
            },
        };
    }

    /**
     * Get all raw timings.
     */
    getTimings(): TimingEntry[] {
        return [...this.timings];
    }

    /**
     * Reset all metrics.
     */
    reset(): void {
        this.timings = [];
        this.pluginTimings.clear();
        this.hookLatencies.clear();
        this.pipelineLatencies = [];
        this.stageLatencies.clear();
        this.startedAt = Date.now();
    }

    // ─── Benchmarking ───────────────────────────────────────────

    /**
     * Run a benchmark: execute fn N times and compute stats.
     */
    async benchmark(name: string, fn: () => Promise<void>, iterations = 100): Promise<BenchmarkResult> {
        const durations: number[] = [];

        // Warmup (10% of iterations)
        const warmup = Math.max(1, Math.floor(iterations * 0.1));
        for (let i = 0; i < warmup; i++) {
            await fn();
        }

        // Measured runs
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await fn();
            durations.push(performance.now() - start);
        }

        durations.sort((a, b) => a - b);
        const totalMs = durations.reduce((a, b) => a + b, 0);

        return {
            name,
            iterations,
            totalMs: round(totalMs),
            avgMs: round(totalMs / iterations),
            minMs: round(durations[0]),
            maxMs: round(durations[iterations - 1]),
            opsPerSec: round((iterations / totalMs) * 1000),
            p95Ms: round(percentile(durations, 0.95)),
            p99Ms: round(percentile(durations, 0.99)),
        };
    }

    /**
     * Run a sync benchmark.
     */
    benchmarkSync(name: string, fn: () => void, iterations = 1000): BenchmarkResult {
        const durations: number[] = [];

        // Warmup
        const warmup = Math.max(1, Math.floor(iterations * 0.1));
        for (let i = 0; i < warmup; i++) fn();

        // Measured runs
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            durations.push(performance.now() - start);
        }

        durations.sort((a, b) => a - b);
        const totalMs = durations.reduce((a, b) => a + b, 0);

        return {
            name,
            iterations,
            totalMs: round(totalMs),
            avgMs: round(totalMs / iterations),
            minMs: round(durations[0]),
            maxMs: round(durations[iterations - 1]),
            opsPerSec: round((iterations / totalMs) * 1000),
            p95Ms: round(percentile(durations, 0.95)),
            p99Ms: round(percentile(durations, 0.99)),
        };
    }

    // ─── Private ────────────────────────────────────────────────

    private recordTiming(entry: TimingEntry): void {
        this.timings.push(entry);
        if (this.timings.length > this.maxTimings) {
            this.timings = this.timings.slice(-this.maxTimings);
        }
    }

    private getLoaderTimings(): SystemPerfReport['loader'] {
        const get = (phase: string): number => {
            const entry = this.timings.find(t => t.label === `loader.${phase}`);
            return entry?.durationMs ?? 0;
        };
        return {
            discoveryTimeMs: get('discovery'),
            dependencyResolutionTimeMs: get('dependency_resolution'),
            totalLoadTimeMs: get('total'),
            sandboxCreationTimeMs: get('sandbox_creation'),
        };
    }
}

// ─── Helpers ────────────────────────────────────────────────────

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[clamp(sorted.length - 1, 0, idx)];
}
