/**
 * plugins/telemetry.ts
 *
 * Plugin Telemetry Collector — Higher-level metrics collection,
 * counters, gauges, histograms, and dashboard API for plugin system.
 *
 * Following CoreBlow's observability patterns upgraded to CoreBlow OOP.
 * Integrates with PluginPerfMonitor for low-level timing and adds:
 *   - Named counters (monotonic increment)
 *   - Gauges (current value tracking)
 *   - Histograms (distribution tracking with percentiles)
 *   - Per-plugin metric namespacing
 *   - Dashboard-ready aggregated views
 *   - Metric alerting (threshold-based)
 *   - Export for external monitoring (Prometheus-compatible)
 */

import { clamp } from "../utils.js";
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:telemetry');

// ─── Types ───────────────────────────────────────────────────────

/** Counter — monotonically increasing value */
export interface Counter {
    name: string;
    value: number;
    labels: Record<string, string>;
    createdAt: number;
    updatedAt: number;
}

/** Gauge — current value that can go up/down */
export interface Gauge {
    name: string;
    value: number;
    labels: Record<string, string>;
    min: number;
    max: number;
    updatedAt: number;
}

/** Histogram bucket */
export interface HistogramBucket {
    le: number; // less-than-or-equal boundary
    count: number;
}

/** Histogram — distribution of values */
export interface Histogram {
    name: string;
    values: number[];
    count: number;
    sum: number;
    labels: Record<string, string>;
    buckets: HistogramBucket[];
    updatedAt: number;
}

/** Metric alert rule */
export interface AlertRule {
    id: string;
    metricName: string;
    condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    threshold: number;
    message: string;
    severity: 'info' | 'warn' | 'critical';
}

/** Triggered alert */
export interface Alert {
    rule: AlertRule;
    currentValue: number;
    timestamp: number;
    pluginId?: string;
}

/** Telemetry dashboard data */
export interface TelemetryDashboard {
    timestamp: number;
    counters: Counter[];
    gauges: Gauge[];
    histograms: Array<{
        name: string;
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
        labels: Record<string, string>;
    }>;
    alerts: Alert[];
    pluginMetrics: Record<string, {
        counters: Counter[];
        gauges: Gauge[];
    }>;
}

/** Prometheus-compatible export line */
export interface PrometheusMetric {
    name: string;
    type: 'counter' | 'gauge' | 'histogram';
    help?: string;
    lines: string[];
}

// ─── Default histogram buckets ───────────────────────────────────

const DEFAULT_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000];

// ─── TelemetryCollector ──────────────────────────────────────────

/**
 * CoreBlow Plugin Telemetry Collector
 *
 * Higher-level metrics collection for the plugin system.
 * Provides counters, gauges, histograms, alerting, and
 * dashboard-ready aggregated views.
 */
export class TelemetryCollector {
    private counters = new Map<string, Counter>();
    private gauges = new Map<string, Gauge>();
    private histograms = new Map<string, Histogram>();
    private alertRules: AlertRule[] = [];
    private activeAlerts: Alert[] = [];
    private alertHandlers: Array<(alert: Alert) => void> = [];
    private maxValues = 10_000;

    // ─── Counters ────────────────────────────────────────────────

    /**
     * Increment a counter.
     */
    increment(name: string, amount = 1, labels: Record<string, string> = {}): number {
        const key = this.makeKey(name, labels);
        let counter = this.counters.get(key);
        if (!counter) {
            counter = { name, value: 0, labels, createdAt: Date.now(), updatedAt: Date.now() };
            this.counters.set(key, counter);
        }
        counter.value += amount;
        counter.updatedAt = Date.now();
        this.checkAlerts(name, counter.value);
        return counter.value;
    }

    /**
     * Get a counter value.
     */
    getCounter(name: string, labels: Record<string, string> = {}): number {
        return this.counters.get(this.makeKey(name, labels))?.value ?? 0;
    }

    /**
     * Get all counters.
     */
    getCounters(): Counter[] {
        return Array.from(this.counters.values()).map((c) => ({ ...c }));
    }

    // ─── Gauges ──────────────────────────────────────────────────

    /**
     * Set a gauge value.
     */
    setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
        const key = this.makeKey(name, labels);
        let gauge = this.gauges.get(key);
        if (!gauge) {
            gauge = { name, value, labels, min: value, max: value, updatedAt: Date.now() };
            this.gauges.set(key, gauge);
        } else {
            gauge.value = value;
            gauge.min = Math.min(gauge.min, value);
            gauge.max = Math.max(gauge.max, value);
            gauge.updatedAt = Date.now();
        }
        this.checkAlerts(name, value);
    }

    /**
     * Get a gauge value.
     */
    getGauge(name: string, labels: Record<string, string> = {}): number {
        return this.gauges.get(this.makeKey(name, labels))?.value ?? 0;
    }

    /**
     * Get all gauges.
     */
    getGauges(): Gauge[] {
        return Array.from(this.gauges.values()).map((g) => ({ ...g }));
    }

    // ─── Histograms ──────────────────────────────────────────────

    /**
     * Observe a value in a histogram.
     */
    observe(name: string, value: number, labels: Record<string, string> = {}): void {
        const key = this.makeKey(name, labels);
        let histogram = this.histograms.get(key);
        if (!histogram) {
            histogram = {
                name,
                values: [],
                count: 0,
                sum: 0,
                labels,
                buckets: DEFAULT_BUCKETS.map((le) => ({ le, count: 0 })),
                updatedAt: Date.now(),
            };
            this.histograms.set(key, histogram);
        }

        histogram.values.push(value);
        if (histogram.values.length > this.maxValues) {
            histogram.values = histogram.values.slice(-this.maxValues);
        }
        histogram.count++;
        histogram.sum += value;
        histogram.updatedAt = Date.now();

        // Update buckets
        for (const bucket of histogram.buckets) {
            if (value <= bucket.le) {
                bucket.count++;
            }
        }
    }

    /**
     * Get histogram stats.
     */
    getHistogramStats(name: string, labels: Record<string, string> = {}): {
        count: number; sum: number; avg: number; min: number; max: number;
        p50: number; p95: number; p99: number;
    } | null {
        const histogram = this.histograms.get(this.makeKey(name, labels));
        if (!histogram || histogram.values.length === 0) return null;

        const sorted = [...histogram.values].sort((a, b) => a - b);
        return {
            count: histogram.count,
            sum: round(histogram.sum),
            avg: round(histogram.sum / histogram.count),
            min: round(sorted[0]),
            max: round(sorted[sorted.length - 1]),
            p50: round(percentile(sorted, 0.50)),
            p95: round(percentile(sorted, 0.95)),
            p99: round(percentile(sorted, 0.99)),
        };
    }

    /**
     * Get all histograms.
     */
    getHistograms(): Histogram[] {
        return Array.from(this.histograms.values()).map((h) => ({ ...h, values: [...h.values] }));
    }

    // ─── Plugin-Scoped Metrics ───────────────────────────────────

    /**
     * Increment a plugin-scoped counter.
     */
    pluginIncrement(pluginId: string, metric: string, amount = 1): number {
        return this.increment(`plugin.${metric}`, amount, { pluginId });
    }

    /**
     * Set a plugin-scoped gauge.
     */
    pluginSetGauge(pluginId: string, metric: string, value: number): void {
        this.setGauge(`plugin.${metric}`, value, { pluginId });
    }

    /**
     * Observe a plugin-scoped histogram value.
     */
    pluginObserve(pluginId: string, metric: string, value: number): void {
        this.observe(`plugin.${metric}`, value, { pluginId });
    }

    /**
     * Get all metrics for a specific plugin.
     */
    getPluginMetrics(pluginId: string): { counters: Counter[]; gauges: Gauge[] } {
        const counters = Array.from(this.counters.values())
            .filter((c) => c.labels.pluginId === pluginId)
            .map((c) => ({ ...c }));
        const gauges = Array.from(this.gauges.values())
            .filter((g) => g.labels.pluginId === pluginId)
            .map((g) => ({ ...g }));
        return { counters, gauges };
    }

    // ─── Alerting ────────────────────────────────────────────────

    /**
     * Add an alert rule.
     */
    addAlertRule(rule: AlertRule): void {
        this.alertRules.push(rule);
    }

    /**
     * Remove an alert rule.
     */
    removeAlertRule(ruleId: string): boolean {
        const before = this.alertRules.length;
        this.alertRules = this.alertRules.filter((r) => r.id !== ruleId);
        return this.alertRules.length < before;
    }

    /**
     * Get active alerts.
     */
    getAlerts(): Alert[] {
        return [...this.activeAlerts];
    }

    /**
     * Subscribe to alert triggers.
     */
    onAlert(handler: (alert: Alert) => void): () => void {
        this.alertHandlers.push(handler);
        return () => {
            this.alertHandlers = this.alertHandlers.filter((h) => h !== handler);
        };
    }

    /**
     * Clear active alerts.
     */
    clearAlerts(): void {
        this.activeAlerts = [];
    }

    // ─── Dashboard ───────────────────────────────────────────────

    /**
     * Get full dashboard data.
     */
    getDashboard(): TelemetryDashboard {
        // Build plugin metrics index
        const pluginIds = new Set<string>();
        for (const c of this.counters.values()) {
            if (c.labels.pluginId) pluginIds.add(c.labels.pluginId);
        }
        for (const g of this.gauges.values()) {
            if (g.labels.pluginId) pluginIds.add(g.labels.pluginId);
        }

        const pluginMetrics: Record<string, { counters: Counter[]; gauges: Gauge[] }> = {};
        for (const pluginId of pluginIds) {
            pluginMetrics[pluginId] = this.getPluginMetrics(pluginId);
        }

        // Build histogram summaries
        const histogramSummaries = Array.from(this.histograms.values()).map((h) => {
            const stats = this.getHistogramStats(h.name, h.labels);
            return {
                name: h.name,
                count: h.count,
                sum: round(h.sum),
                avg: stats?.avg ?? 0,
                min: stats?.min ?? 0,
                max: stats?.max ?? 0,
                p50: stats?.p50 ?? 0,
                p95: stats?.p95 ?? 0,
                p99: stats?.p99 ?? 0,
                labels: h.labels,
            };
        });

        return {
            timestamp: Date.now(),
            counters: this.getCounters(),
            gauges: this.getGauges(),
            histograms: histogramSummaries,
            alerts: this.getAlerts(),
            pluginMetrics,
        };
    }

    // ─── Export (Prometheus-compatible) ───────────────────────────

    /**
     * Export metrics in Prometheus text format.
     */
    exportPrometheus(): string {
        const lines: string[] = [];

        // Counters
        for (const counter of this.counters.values()) {
            const sanitized = sanitizeName(counter.name);
            const labelStr = formatLabels(counter.labels);
            lines.push(`# TYPE ${sanitized}_total counter`);
            lines.push(`${sanitized}_total${labelStr} ${counter.value}`);
        }

        // Gauges
        for (const gauge of this.gauges.values()) {
            const sanitized = sanitizeName(gauge.name);
            const labelStr = formatLabels(gauge.labels);
            lines.push(`# TYPE ${sanitized} gauge`);
            lines.push(`${sanitized}${labelStr} ${gauge.value}`);
        }

        // Histograms
        for (const histogram of this.histograms.values()) {
            const sanitized = sanitizeName(histogram.name);
            const labelStr = formatLabels(histogram.labels);
            lines.push(`# TYPE ${sanitized} histogram`);
            for (const bucket of histogram.buckets) {
                const bucketLabels = histogram.labels.pluginId
                    ? `{pluginId="${histogram.labels.pluginId}",le="${bucket.le}"}`
                    : `{le="${bucket.le}"}`;
                lines.push(`${sanitized}_bucket${bucketLabels} ${bucket.count}`);
            }
            lines.push(`${sanitized}_sum${labelStr} ${round(histogram.sum)}`);
            lines.push(`${sanitized}_count${labelStr} ${histogram.count}`);
        }

        return lines.join('\n');
    }

    // ─── Management ──────────────────────────────────────────────

    /**
     * Reset all metrics.
     */
    reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.activeAlerts = [];
    }

    /**
     * Get total metric count.
     */
    getMetricCount(): number {
        return this.counters.size + this.gauges.size + this.histograms.size;
    }

    // ─── Private ─────────────────────────────────────────────────

    private makeKey(name: string, labels: Record<string, string>): string {
        const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
        return `${name}{${sorted.map(([k, v]) => `${k}=${v}`).join(',')}}`;
    }

    private checkAlerts(metricName: string, value: number): void {
        for (const rule of this.alertRules) {
            if (rule.metricName !== metricName) continue;

            let triggered = false;
            switch (rule.condition) {
                case 'gt': triggered = value > rule.threshold; break;
                case 'lt': triggered = value < rule.threshold; break;
                case 'gte': triggered = value >= rule.threshold; break;
                case 'lte': triggered = value <= rule.threshold; break;
                case 'eq': triggered = value === rule.threshold; break;
            }

            if (triggered) {
                const alert: Alert = { rule, currentValue: value, timestamp: Date.now() };
                this.activeAlerts.push(alert);
                if (this.activeAlerts.length > 500) {
                    this.activeAlerts = this.activeAlerts.slice(-500);
                }
                for (const handler of this.alertHandlers) {
                    try { handler(alert); } catch { /* skip */ }
                }
            }
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[clamp(sorted.length - 1, 0, idx)];
}

function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
}
