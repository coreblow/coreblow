/**
 * CoreBlow — Metric Aggregator
 *
 * Aggregates metrics over time windows with min/max/avg/sum/p95/p99
 * calculations. Supports bucketing and rollups.
 */

/** Metric point */
export interface MetricPoint {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
}

/** Aggregated metric */
export interface AggregatedMetric {
    name: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
    windowStart: number;
    windowEnd: number;
}

/**
 * CoreBlow Metric Aggregator
 */
export class MetricAggregator {
    private points: MetricPoint[] = [];
    private maxPoints = 100_000;

    /**
     * Record a metric point.
     */
    record(name: string, value: number, tags?: Record<string, string>): void {
        this.points.push({ name, value, timestamp: Date.now(), tags });
        if (this.points.length > this.maxPoints) this.points = this.points.slice(-this.maxPoints);
    }

    /**
     * Aggregate over a time window.
     */
    aggregate(name: string, windowMs: number): AggregatedMetric {
        const now = Date.now();
        const windowStart = now - windowMs;
        const filtered = this.points.filter((p) => p.name === name && p.timestamp >= windowStart);

        if (filtered.length === 0) {
            return { name, count: 0, sum: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0, windowStart, windowEnd: now };
        }

        const values = filtered.map((p) => p.value).sort((a, b) => a - b);
        const sum = values.reduce((s, v) => s + v, 0);

        return {
            name, count: values.length, sum,
            min: values[0]!, max: values[values.length - 1]!,
            avg: sum / values.length,
            p95: values[Math.floor(values.length * 0.95)] ?? values[values.length - 1]!,
            p99: values[Math.floor(values.length * 0.99)] ?? values[values.length - 1]!,
            windowStart, windowEnd: now,
        };
    }

    /**
     * Get rate (points per second).
     */
    rate(name: string, windowMs: number): number {
        const now = Date.now();
        const count = this.points.filter((p) => p.name === name && p.timestamp >= now - windowMs).length;
        return count / (windowMs / 1000);
    }

    /**
     * List metric names.
     */
    listMetrics(): string[] {
        return Array.from(new Set(this.points.map((p) => p.name)));
    }

    /**
     * Filter by tags.
     */
    filterByTag(name: string, tagKey: string, tagValue: string): MetricPoint[] {
        return this.points.filter((p) => p.name === name && p.tags?.[tagKey] === tagValue);
    }

    /**
     * Clear metrics.
     */
    clear(): void { this.points = []; }

    /** Count */
    count(): number { return this.points.length; }
}
