import { describe, it, expect, beforeEach } from 'vitest';
import {
    TelemetryCollector,
    type Alert,
    type AlertRule,
} from './telemetry.js';
import { PluginPerfMonitor } from './perf-monitor.js';

// ─── TelemetryCollector Tests ────────────────────────────────────

describe('TelemetryCollector', () => {
    let tc: TelemetryCollector;

    beforeEach(() => {
        tc = new TelemetryCollector();
    });

    // ════════════════════════════════════════════════════════════
    // Counters (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('counters', () => {
        it('should increment counter', () => {
            tc.increment('requests');
            expect(tc.getCounter('requests')).toBe(1);
        });

        it('should increment by custom amount', () => {
            tc.increment('bytes', 1024);
            expect(tc.getCounter('bytes')).toBe(1024);
        });

        it('should accumulate increments', () => {
            tc.increment('requests');
            tc.increment('requests');
            tc.increment('requests');
            expect(tc.getCounter('requests')).toBe(3);
        });

        it('should support labeled counters', () => {
            tc.increment('requests', 1, { method: 'GET' });
            tc.increment('requests', 1, { method: 'POST' });
            expect(tc.getCounter('requests', { method: 'GET' })).toBe(1);
            expect(tc.getCounter('requests', { method: 'POST' })).toBe(1);
        });

        it('should return 0 for unknown counter', () => {
            expect(tc.getCounter('unknown')).toBe(0);
        });

        it('should list all counters', () => {
            tc.increment('a');
            tc.increment('b');
            expect(tc.getCounters()).toHaveLength(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Gauges (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('gauges', () => {
        it('should set gauge value', () => {
            tc.setGauge('memory', 512);
            expect(tc.getGauge('memory')).toBe(512);
        });

        it('should update gauge value', () => {
            tc.setGauge('memory', 512);
            tc.setGauge('memory', 1024);
            expect(tc.getGauge('memory')).toBe(1024);
        });

        it('should track min/max', () => {
            tc.setGauge('cpu', 50);
            tc.setGauge('cpu', 90);
            tc.setGauge('cpu', 30);
            const gauges = tc.getGauges();
            const cpu = gauges.find((g) => g.name === 'cpu');
            expect(cpu!.min).toBe(30);
            expect(cpu!.max).toBe(90);
        });

        it('should support labeled gauges', () => {
            tc.setGauge('connections', 10, { host: 'a' });
            tc.setGauge('connections', 20, { host: 'b' });
            expect(tc.getGauge('connections', { host: 'a' })).toBe(10);
            expect(tc.getGauge('connections', { host: 'b' })).toBe(20);
        });

        it('should return 0 for unknown gauge', () => {
            expect(tc.getGauge('unknown')).toBe(0);
        });

        it('should list all gauges', () => {
            tc.setGauge('a', 1);
            tc.setGauge('b', 2);
            expect(tc.getGauges()).toHaveLength(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Histograms (7 tests)
    // ════════════════════════════════════════════════════════════

    describe('histograms', () => {
        it('should observe values', () => {
            tc.observe('latency', 50);
            tc.observe('latency', 100);
            tc.observe('latency', 150);
            const stats = tc.getHistogramStats('latency');
            expect(stats).not.toBeNull();
            expect(stats!.count).toBe(3);
        });

        it('should compute avg', () => {
            tc.observe('latency', 10);
            tc.observe('latency', 20);
            tc.observe('latency', 30);
            const stats = tc.getHistogramStats('latency');
            expect(stats!.avg).toBe(20);
        });

        it('should compute min/max', () => {
            tc.observe('latency', 5);
            tc.observe('latency', 500);
            tc.observe('latency', 50);
            const stats = tc.getHistogramStats('latency');
            expect(stats!.min).toBe(5);
            expect(stats!.max).toBe(500);
        });

        it('should compute percentiles', () => {
            // Add 100 values: 1, 2, 3, ..., 100
            for (let i = 1; i <= 100; i++) {
                tc.observe('latency', i);
            }
            const stats = tc.getHistogramStats('latency');
            expect(stats!.p50).toBe(50);
            expect(stats!.p95).toBe(95);
            expect(stats!.p99).toBe(99);
        });

        it('should compute sum', () => {
            tc.observe('latency', 10);
            tc.observe('latency', 20);
            const stats = tc.getHistogramStats('latency');
            expect(stats!.sum).toBe(30);
        });

        it('should return null for unknown histogram', () => {
            expect(tc.getHistogramStats('unknown')).toBeNull();
        });

        it('should support labeled histograms', () => {
            tc.observe('latency', 50, { endpoint: '/api' });
            tc.observe('latency', 100, { endpoint: '/health' });
            const stats1 = tc.getHistogramStats('latency', { endpoint: '/api' });
            const stats2 = tc.getHistogramStats('latency', { endpoint: '/health' });
            expect(stats1!.avg).toBe(50);
            expect(stats2!.avg).toBe(100);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Plugin-Scoped Metrics (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('plugin metrics', () => {
        it('should increment plugin counter', () => {
            tc.pluginIncrement('weather-plugin', 'api_calls');
            expect(tc.getCounter('plugin.api_calls', { pluginId: 'weather-plugin' })).toBe(1);
        });

        it('should set plugin gauge', () => {
            tc.pluginSetGauge('weather-plugin', 'cache_size', 42);
            expect(tc.getGauge('plugin.cache_size', { pluginId: 'weather-plugin' })).toBe(42);
        });

        it('should observe plugin histogram', () => {
            tc.pluginObserve('weather-plugin', 'response_time', 50);
            tc.pluginObserve('weather-plugin', 'response_time', 100);
            const stats = tc.getHistogramStats('plugin.response_time', { pluginId: 'weather-plugin' });
            expect(stats!.count).toBe(2);
        });

        it('should get all metrics for a plugin', () => {
            tc.pluginIncrement('weather-plugin', 'calls');
            tc.pluginSetGauge('weather-plugin', 'memory', 100);
            const metrics = tc.getPluginMetrics('weather-plugin');
            expect(metrics.counters).toHaveLength(1);
            expect(metrics.gauges).toHaveLength(1);
        });

        it('should isolate metrics between plugins', () => {
            tc.pluginIncrement('plugin-a', 'calls', 5);
            tc.pluginIncrement('plugin-b', 'calls', 10);
            expect(tc.getPluginMetrics('plugin-a').counters[0].value).toBe(5);
            expect(tc.getPluginMetrics('plugin-b').counters[0].value).toBe(10);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Alerting (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('alerting', () => {
        it('should trigger alert on threshold breach', () => {
            tc.addAlertRule({
                id: 'high-errors',
                metricName: 'errors',
                condition: 'gt',
                threshold: 10,
                message: 'Error rate too high',
                severity: 'critical',
            });
            for (let i = 0; i < 15; i++) tc.increment('errors');
            const alerts = tc.getAlerts();
            expect(alerts.length).toBeGreaterThan(0);
        });

        it('should not trigger when below threshold', () => {
            tc.addAlertRule({
                id: 'high-errors',
                metricName: 'errors',
                condition: 'gt',
                threshold: 100,
                message: 'Too many errors',
                severity: 'warn',
            });
            tc.increment('errors', 5);
            expect(tc.getAlerts()).toHaveLength(0);
        });

        it('should support lt condition', () => {
            tc.addAlertRule({
                id: 'low-memory',
                metricName: 'memory',
                condition: 'lt',
                threshold: 100,
                message: 'Low memory',
                severity: 'warn',
            });
            tc.setGauge('memory', 50);
            expect(tc.getAlerts().length).toBeGreaterThan(0);
        });

        it('should call alert handlers', () => {
            const triggered: Alert[] = [];
            tc.onAlert((a) => triggered.push(a));
            tc.addAlertRule({
                id: 'test',
                metricName: 'counter',
                condition: 'gte',
                threshold: 1,
                message: 'Hit',
                severity: 'info',
            });
            tc.increment('counter');
            expect(triggered).toHaveLength(1);
        });

        it('should remove alert rule', () => {
            tc.addAlertRule({ id: 'test', metricName: 'x', condition: 'gt', threshold: 0, message: '', severity: 'info' });
            expect(tc.removeAlertRule('test')).toBe(true);
            expect(tc.removeAlertRule('nonexistent')).toBe(false);
        });

        it('should clear alerts', () => {
            tc.addAlertRule({ id: 'test', metricName: 'x', condition: 'gte', threshold: 1, message: '', severity: 'info' });
            tc.increment('x');
            expect(tc.getAlerts().length).toBeGreaterThan(0);
            tc.clearAlerts();
            expect(tc.getAlerts()).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Dashboard (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('dashboard', () => {
        it('should generate dashboard data', () => {
            tc.increment('requests');
            tc.setGauge('memory', 512);
            tc.observe('latency', 50);
            const dashboard = tc.getDashboard();
            expect(dashboard.counters).toHaveLength(1);
            expect(dashboard.gauges).toHaveLength(1);
            expect(dashboard.histograms).toHaveLength(1);
        });

        it('should include plugin metrics in dashboard', () => {
            tc.pluginIncrement('weather-plugin', 'calls');
            const dashboard = tc.getDashboard();
            expect(dashboard.pluginMetrics['weather-plugin']).toBeDefined();
            expect(dashboard.pluginMetrics['weather-plugin'].counters).toHaveLength(1);
        });

        it('should include alerts in dashboard', () => {
            tc.addAlertRule({ id: 'test', metricName: 'x', condition: 'gte', threshold: 1, message: '', severity: 'info' });
            tc.increment('x');
            const dashboard = tc.getDashboard();
            expect(dashboard.alerts.length).toBeGreaterThan(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Prometheus Export (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('prometheus export', () => {
        it('should export counters', () => {
            tc.increment('http_requests', 42);
            const output = tc.exportPrometheus();
            expect(output).toContain('http_requests_total');
            expect(output).toContain('42');
        });

        it('should export gauges', () => {
            tc.setGauge('memory_usage', 512);
            const output = tc.exportPrometheus();
            expect(output).toContain('memory_usage');
            expect(output).toContain('512');
        });

        it('should export histograms with buckets', () => {
            tc.observe('request_duration', 50);
            const output = tc.exportPrometheus();
            expect(output).toContain('request_duration_bucket');
            expect(output).toContain('request_duration_sum');
            expect(output).toContain('request_duration_count');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Management (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('management', () => {
        it('should reset all metrics', () => {
            tc.increment('a');
            tc.setGauge('b', 1);
            tc.observe('c', 1);
            tc.reset();
            expect(tc.getMetricCount()).toBe(0);
        });

        it('should count total metrics', () => {
            tc.increment('counter');
            tc.setGauge('gauge', 1);
            tc.observe('histogram', 1);
            expect(tc.getMetricCount()).toBe(3);
        });

        it('should support unsubscribe from alerts', () => {
            const alerts: Alert[] = [];
            const unsub = tc.onAlert((a) => alerts.push(a));
            unsub();
            tc.addAlertRule({ id: 'test', metricName: 'x', condition: 'gte', threshold: 1, message: '', severity: 'info' });
            tc.increment('x');
            expect(alerts).toHaveLength(0);
        });
    });
});

// ─── PluginPerfMonitor Tests ─────────────────────────────────────

describe('PluginPerfMonitor', () => {
    let monitor: PluginPerfMonitor;

    beforeEach(() => {
        monitor = new PluginPerfMonitor();
    });

    describe('timing', () => {
        it('should record timing with startTimer', () => {
            const stop = monitor.startTimer('test-op');
            stop();
            expect(monitor.getTimings()).toHaveLength(1);
            expect(monitor.getTimings()[0].label).toBe('test-op');
        });

        it('should measure async function', async () => {
            const { result, durationMs } = await monitor.measure('async-op', async () => {
                return 42;
            });
            expect(result).toBe(42);
            expect(durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should measure sync function', () => {
            const { result, durationMs } = monitor.measureSync('sync-op', () => 'hello');
            expect(result).toBe('hello');
            expect(durationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('plugin lifecycle', () => {
        it('should record plugin load time', () => {
            monitor.recordPluginLoad('plugin-a', 50);
            const snapshots = monitor.getPluginSnapshots();
            expect(snapshots).toHaveLength(1);
            expect(snapshots[0].loadTimeMs).toBe(50);
        });

        it('should record plugin activate time', () => {
            monitor.recordPluginLoad('plugin-a', 50);
            monitor.recordPluginActivate('plugin-a', 20);
            const snapshots = monitor.getPluginSnapshots();
            expect(snapshots[0].activateTimeMs).toBe(20);
        });

        it('should record hook execution', () => {
            monitor.recordPluginLoad('plugin-a', 10);
            monitor.recordHookExecution('onMessage', 'plugin-a', 5);
            monitor.recordHookExecution('onMessage', 'plugin-a', 3);
            const snapshots = monitor.getPluginSnapshots();
            expect(snapshots[0].hookExecutions).toBe(2);
            expect(snapshots[0].totalHookTimeMs).toBe(8);
        });
    });

    describe('pipeline', () => {
        it('should record pipeline latency', () => {
            monitor.recordPipelineLatency(10);
            monitor.recordPipelineLatency(20);
            monitor.recordPipelineLatency(30);
            const snapshot = monitor.getPipelineSnapshot();
            expect(snapshot.messagesProcessed).toBe(3);
            expect(snapshot.avgLatencyMs).toBe(20);
        });

        it('should record stage latency', () => {
            monitor.recordPipelineLatency(10, 'parse');
            monitor.recordPipelineLatency(20, 'validate');
            const snapshot = monitor.getPipelineSnapshot();
            expect(snapshot.messagesProcessed).toBe(2);
        });

        it('should return zero snapshot when empty', () => {
            const snapshot = monitor.getPipelineSnapshot();
            expect(snapshot.messagesProcessed).toBe(0);
            expect(snapshot.avgLatencyMs).toBe(0);
        });
    });

    describe('report', () => {
        it('should generate full report', () => {
            monitor.recordPluginLoad('plugin-a', 50);
            monitor.recordPipelineLatency(10);
            const report = monitor.getReport();
            expect(report.plugins).toHaveLength(1);
            expect(report.memory.heapUsedMb).toBeGreaterThan(0);
        });

        it('should record loader phase', () => {
            monitor.recordLoaderPhase('discovery', 100);
            const report = monitor.getReport();
            expect(report.loader.discoveryTimeMs).toBe(100);
        });
    });

    describe('reset', () => {
        it('should reset all metrics', () => {
            monitor.recordPluginLoad('a', 10);
            monitor.recordPipelineLatency(20);
            monitor.reset();
            expect(monitor.getPluginSnapshots()).toHaveLength(0);
            expect(monitor.getPipelineSnapshot().messagesProcessed).toBe(0);
        });
    });

    describe('benchmark', () => {
        it('should run sync benchmark', () => {
            const result = monitor.benchmarkSync('noop', () => {}, 100);
            expect(result.iterations).toBe(100);
            expect(result.avgMs).toBeGreaterThanOrEqual(0);
            expect(result.opsPerSec).toBeGreaterThan(0);
        });

        it('should run async benchmark', async () => {
            const result = await monitor.benchmark('async-noop', async () => {}, 50);
            expect(result.iterations).toBe(50);
            expect(result.avgMs).toBeGreaterThanOrEqual(0);
        });
    });
});
