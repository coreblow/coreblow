/**
 * Wave 15: Performance & Benchmarks
 *
 * Tests the PluginPerfMonitor, benchmarks core plugin operations,
 * and verifies performance characteristics of the plugin pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    PluginPerfMonitor,
    type BenchmarkResult,
    type PluginPerfSnapshot,
    type PipelinePerfSnapshot,
    type SystemPerfReport,
} from '../../src/plugins/perf-monitor.js';
import { MetricAggregator } from '../../src/observability/metric-aggregator.js';
import { PluginLoader } from '../../src/plugins/plugin-loader.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { PluginMessageBridge, type PipelineMessage } from '../../src/plugins/message-bridge.js';
import { PluginMarketplace } from '../../src/plugins/marketplace.js';
import type { MarketplacePlugin } from '../../src/plugins/types.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createPluginDir(baseDir: string, name: string): string {
    const pluginDir = path.join(baseDir, name);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ name, version: '1.0.0', description: `Perf test: ${name}` }),
    );
    fs.writeFileSync(path.join(pluginDir, 'src', 'index.ts'), `export default { activate: async () => {} };`);
    return pluginDir;
}

function createTestMessage(content = 'perf-test'): PipelineMessage {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionKey: 'perf-session',
        channel: 'test',
        content,
        sender: { id: 'perf-user', name: 'Perf Tester', role: 'user' },
        timestamp: Date.now(),
    };
}

// ═══════════════════════════════════════════════════════════════════
// PluginPerfMonitor — Core
// ═══════════════════════════════════════════════════════════════════

describe('PluginPerfMonitor', () => {
    let monitor: PluginPerfMonitor;

    beforeEach(() => {
        monitor = new PluginPerfMonitor();
    });

    // --- Timer ---

    it('starts and stops a timer', () => {
        const stop = monitor.startTimer('test-op');
        // Simulate work
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        const durationMs = stop();

        expect(durationMs).toBeGreaterThanOrEqual(0);
        expect(monitor.getTimings()).toHaveLength(1);
        expect(monitor.getTimings()[0].label).toBe('test-op');
    });

    it('measures async function', async () => {
        const { result, durationMs } = await monitor.measure('async-op', async () => {
            await new Promise(r => setTimeout(r, 5));
            return 42;
        });

        expect(result).toBe(42);
        expect(durationMs).toBeGreaterThan(0);
    });

    it('measures sync function', () => {
        const { result, durationMs } = monitor.measureSync('sync-op', () => {
            let sum = 0;
            for (let i = 0; i < 10000; i++) sum += i;
            return sum;
        });

        expect(result).toBe(49995000);
        expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it('records timer with metadata', () => {
        const stop = monitor.startTimer('tagged-op', { pluginId: 'test', phase: 'load' });
        stop();

        const timings = monitor.getTimings();
        expect(timings[0].metadata).toEqual({ pluginId: 'test', phase: 'load' });
    });

    // --- Plugin Lifecycle ---

    it('records plugin load time', () => {
        monitor.recordPluginLoad('alpha', 15.5);
        monitor.recordPluginLoad('beta', 22.3);

        const snapshots = monitor.getPluginSnapshots();
        expect(snapshots).toHaveLength(2);
        expect(snapshots.find(s => s.pluginId === 'alpha')!.loadTimeMs).toBe(15.5);
        expect(snapshots.find(s => s.pluginId === 'beta')!.loadTimeMs).toBe(22.3);
    });

    it('records plugin activate time', () => {
        monitor.recordPluginLoad('gamma', 10);
        monitor.recordPluginActivate('gamma', 5.2);

        const snap = monitor.getPluginSnapshots().find(s => s.pluginId === 'gamma')!;
        expect(snap.loadTimeMs).toBe(10);
        expect(snap.activateTimeMs).toBe(5.2);
    });

    // --- Hook Execution ---

    it('records hook execution latency', () => {
        monitor.recordPluginLoad('hooker', 1);
        monitor.recordHookExecution('message_received', 'hooker', 0.5);
        monitor.recordHookExecution('message_received', 'hooker', 0.8);
        monitor.recordHookExecution('message_sent', 'hooker', 0.3);

        const snap = monitor.getPluginSnapshots().find(s => s.pluginId === 'hooker')!;
        expect(snap.hookExecutions).toBe(3);
        expect(snap.totalHookTimeMs).toBeCloseTo(1.6);
        expect(snap.avgHookLatencyMs).toBeCloseTo(1.6 / 3);
    });

    // --- Pipeline ---

    it('records pipeline latency', () => {
        monitor.recordPipelineLatency(10);
        monitor.recordPipelineLatency(15);
        monitor.recordPipelineLatency(12);

        const snap = monitor.getPipelineSnapshot();
        expect(snap.messagesProcessed).toBe(3);
        expect(snap.avgLatencyMs).toBeCloseTo(12.33, 1);
        expect(snap.minLatencyMs).toBe(10);
        expect(snap.maxLatencyMs).toBe(15);
    });

    it('records stage-level pipeline latency', () => {
        monitor.recordPipelineLatency(5, 'received');
        monitor.recordPipelineLatency(10, 'dispatch');
        monitor.recordPipelineLatency(3, 'received');

        const snap = monitor.getPipelineSnapshot();
        expect(snap.stageBreakdown).toBeDefined();
        expect(Object.keys(snap.stageBreakdown)).toContain('received');
    });

    it('returns empty pipeline snapshot when no data', () => {
        const snap = monitor.getPipelineSnapshot();
        expect(snap.messagesProcessed).toBe(0);
        expect(snap.avgLatencyMs).toBe(0);
        expect(snap.throughputPerSec).toBe(0);
    });

    // --- P95/P99 ---

    it('computes p95 and p99 latencies', () => {
        // Add 100 latency samples: 1ms to 100ms
        for (let i = 1; i <= 100; i++) {
            monitor.recordPipelineLatency(i);
        }

        const snap = monitor.getPipelineSnapshot();
        expect(snap.p95LatencyMs).toBe(95);
        expect(snap.p99LatencyMs).toBe(99);
    });

    // --- Loader Phases ---

    it('records loader phase timings', () => {
        monitor.recordLoaderPhase('discovery', 10);
        monitor.recordLoaderPhase('dependency_resolution', 5);
        monitor.recordLoaderPhase('sandbox_creation', 8);
        monitor.recordLoaderPhase('total', 50);

        const report = monitor.getReport();
        expect(report.loader.discoveryTimeMs).toBe(10);
        expect(report.loader.dependencyResolutionTimeMs).toBe(5);
        expect(report.loader.sandboxCreationTimeMs).toBe(8);
        expect(report.loader.totalLoadTimeMs).toBe(50);
    });

    // --- System Report ---

    it('generates full system report', () => {
        monitor.recordPluginLoad('test', 10);
        monitor.recordPluginActivate('test', 5);
        monitor.recordHookExecution('message_received', 'test', 1);
        monitor.recordPipelineLatency(15);
        monitor.recordLoaderPhase('total', 30);

        const report = monitor.getReport();

        expect(report.timestamp).toBeGreaterThan(0);
        expect(report.uptime).toBeGreaterThanOrEqual(0);
        expect(report.plugins).toHaveLength(1);
        expect(report.pipeline.messagesProcessed).toBe(1);
        expect(report.memory.heapUsedMb).toBeGreaterThan(0);
        expect(report.memory.rssMb).toBeGreaterThan(0);
    });

    // --- Reset ---

    it('resets all metrics', () => {
        monitor.recordPluginLoad('test', 10);
        monitor.recordPipelineLatency(15);
        monitor.recordHookExecution('message_received', 'test', 1);

        monitor.reset();

        expect(monitor.getTimings()).toHaveLength(0);
        expect(monitor.getPluginSnapshots()).toHaveLength(0);
        expect(monitor.getPipelineSnapshot().messagesProcessed).toBe(0);
    });

    // --- Timing Limits ---

    it('caps timings at maxTimings', () => {
        for (let i = 0; i < 12000; i++) {
            const stop = monitor.startTimer(`op-${i}`);
            stop();
        }
        // Default max is 10000
        expect(monitor.getTimings().length).toBeLessThanOrEqual(10000);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Benchmarking Engine
// ═══════════════════════════════════════════════════════════════════

describe('PluginPerfMonitor — Benchmarking', () => {
    let monitor: PluginPerfMonitor;

    beforeEach(() => {
        monitor = new PluginPerfMonitor();
    });

    it('runs async benchmark', async () => {
        const result = await monitor.benchmark('async-noop', async () => {}, 50);

        expect(result.name).toBe('async-noop');
        expect(result.iterations).toBe(50);
        expect(result.totalMs).toBeGreaterThanOrEqual(0);
        expect(result.avgMs).toBeGreaterThanOrEqual(0);
        expect(result.minMs).toBeGreaterThanOrEqual(0);
        expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
        expect(result.opsPerSec).toBeGreaterThan(0);
        expect(result.p95Ms).toBeGreaterThanOrEqual(0);
        expect(result.p99Ms).toBeGreaterThanOrEqual(0);
    });

    it('runs sync benchmark', () => {
        const result = monitor.benchmarkSync('sync-noop', () => {}, 100);

        expect(result.name).toBe('sync-noop');
        expect(result.iterations).toBe(100);
        expect(result.opsPerSec).toBeGreaterThan(0);
    });

    it('benchmark includes warmup', async () => {
        let callCount = 0;
        await monitor.benchmark('count-calls', async () => { callCount++; }, 50);

        // 50 measured + 5 warmup (10%)
        expect(callCount).toBe(55);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Benchmark Plugin Operations
// ═══════════════════════════════════════════════════════════════════

describe('Performance Benchmarks — Plugin Operations', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let monitor: PluginPerfMonitor;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
        monitor = new PluginPerfMonitor();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('benchmarks plugin discovery + load', async () => {
        for (let i = 0; i < 5; i++) createPluginDir(pluginsDir, `plugin-${i}`);

        const result = await monitor.benchmark('plugin-load-5', async () => {
            PluginLoader.clearCache();
            const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();
            await loader.shutdown();
        }, 10);

        expect(result.avgMs).toBeGreaterThan(0);
        expect(result.iterations).toBe(10);
        // Should load within reasonable time
        expect(result.avgMs).toBeLessThan(500);
    });

    it('benchmarks hook runner execution', async () => {
        createPluginDir(pluginsDir, 'bench-hook');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const registry = loader.getRegistry();
        registry.registerTypedHook({
            hookName: 'message_received',
            pluginId: 'bench-hook',
            handler: () => {},
        });

        const hookRunner = loader.getHookRunner();
        const result = await monitor.benchmark('hook-execution', async () => {
            await hookRunner.runVoidHook('message_received', { content: 'test' }, {});
        }, 100);

        expect(result.avgMs).toBeLessThan(10); // Hook should be < 10ms
        expect(result.opsPerSec).toBeGreaterThan(100);

        await loader.shutdown();
    });

    it('benchmarks message pipeline throughput', async () => {
        createPluginDir(pluginsDir, 'bench-pipeline');
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const bridge = new PluginMessageBridge(loader.getHookRunner());
        bridge.setHandler(async (msg) => `Echo: ${msg.content}`);

        const result = await monitor.benchmark('pipeline-message', async () => {
            await bridge.processMessage(createTestMessage());
        }, 100);

        expect(result.avgMs).toBeLessThan(50); // Pipeline should be < 50ms
        expect(result.opsPerSec).toBeGreaterThan(20);

        // Record for report
        for (let i = 0; i < 100; i++) {
            monitor.recordPipelineLatency(result.avgMs + (Math.random() - 0.5) * 2);
        }

        const snapshot = monitor.getPipelineSnapshot();
        expect(snapshot.messagesProcessed).toBe(100);
        expect(snapshot.p95LatencyMs).toBeGreaterThan(0);

        await loader.shutdown();
    });

    it('benchmarks marketplace search', () => {
        const marketplace = new PluginMarketplace();
        const plugins: MarketplacePlugin[] = [];
        for (let i = 0; i < 100; i++) {
            plugins.push({
                id: `plugin-${i}`,
                name: `Plugin ${i}`,
                version: '1.0.0',
                description: `Test plugin number ${i}`,
                author: i % 2 === 0 ? 'Alice' : 'Bob',
                tags: [i % 3 === 0 ? 'tool' : 'channel', 'test'],
                downloads: Math.floor(Math.random() * 10000),
                verified: i % 5 === 0,
            } as MarketplacePlugin);
        }
        marketplace.loadCatalog(plugins);

        const result = monitor.benchmarkSync('marketplace-search', () => {
            marketplace.search({ query: 'plugin', sort: 'downloads', limit: 20 });
        }, 500);

        expect(result.avgMs).toBeLessThan(5); // Search should be < 5ms
        expect(result.opsPerSec).toBeGreaterThan(200);
    });

    it('benchmarks registry lookup', async () => {
        // Load 10 plugins and benchmark registry operations
        for (let i = 0; i < 10; i++) createPluginDir(pluginsDir, `reg-${i}`);
        const loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        const registry = loader.getRegistry();
        const result = monitor.benchmarkSync('registry-lookup', () => {
            registry.getPlugin('reg-5');
            registry.getPlugins();
            registry.getSummary();
        }, 500);

        expect(result.avgMs).toBeLessThan(5);
        expect(result.opsPerSec).toBeGreaterThan(200);

        await loader.shutdown();
    });
});

// ═══════════════════════════════════════════════════════════════════
// MetricAggregator Integration
// ═══════════════════════════════════════════════════════════════════

describe('MetricAggregator Integration', () => {
    let aggregator: MetricAggregator;

    beforeEach(() => {
        aggregator = new MetricAggregator();
    });

    it('records and aggregates metrics', () => {
        for (let i = 1; i <= 50; i++) {
            aggregator.record('test.latency', i);
        }

        const agg = aggregator.aggregate('test.latency', 60_000);
        expect(agg.count).toBe(50);
        expect(agg.min).toBe(1);
        expect(agg.max).toBe(50);
        expect(agg.avg).toBeCloseTo(25.5, 0);
        expect(agg.sum).toBe(1275);
    });

    it('computes p95 and p99', () => {
        for (let i = 1; i <= 100; i++) {
            aggregator.record('test.p', i);
        }

        const agg = aggregator.aggregate('test.p', 60_000);
        // MetricAggregator may use different interpolation — accept ±1
        expect(agg.p95).toBeGreaterThanOrEqual(94);
        expect(agg.p95).toBeLessThanOrEqual(96);
        expect(agg.p99).toBeGreaterThanOrEqual(98);
        expect(agg.p99).toBeLessThanOrEqual(100);
    });

    it('respects time window', async () => {
        aggregator.record('old', 100);
        await new Promise(r => setTimeout(r, 20));
        aggregator.record('old', 200);

        // Window of 10ms should only catch the latest
        const agg = aggregator.aggregate('old', 10);
        expect(agg.count).toBeLessThanOrEqual(1);
    });

    it('handles empty metric', () => {
        const agg = aggregator.aggregate('nonexistent', 60_000);
        expect(agg.count).toBe(0);
        expect(agg.avg).toBe(0);
    });

    it('integrates with PluginPerfMonitor', () => {
        const monitor = new PluginPerfMonitor(aggregator);

        monitor.recordPluginLoad('test', 15);
        monitor.recordHookExecution('message_received', 'test', 2);
        monitor.recordPipelineLatency(10);

        // Check aggregator recorded the metrics
        const hookAgg = aggregator.aggregate('hook.execution', 60_000);
        expect(hookAgg.count).toBe(1);
        expect(hookAgg.avg).toBe(2);

        const pipelineAgg = aggregator.aggregate('pipeline.latency', 60_000);
        expect(pipelineAgg.count).toBe(1);
    });
});
