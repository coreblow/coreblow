/**
 * CoreBlow — Metric Aggregator
 *
 * In-memory aggregation engine for metrics (Counters, Gauges).
 * Fast, synchronous, and thread-safe for Node.js event loop.
 */

export interface MetricSnapshot {
    counters: Record<string, number>;
    gauges: Record<string, number>;
}

/**
 * CoreBlow Metric Aggregator
 */
export class MetricAggregator {
    private counters = new Map<string, number>();
    private gauges = new Map<string, number>();

    /**
     * Increment a counter. Defaults to increment by 1.
     */
    increment(key: string, value: number = 1): void {
        const current = this.counters.get(key) ?? 0;
        this.counters.set(key, current + value);
    }

    /**
     * Decrement a counter.
     */
    decrement(key: string, value: number = 1): void {
        this.increment(key, -value);
    }

    /**
     * Set a gauge to a specific value.
     * Gauges represent a value that can go up and down (like memory).
     */
    setGauge(key: string, value: number): void {
        this.gauges.set(key, value);
    }

    /**
     * Get the current value of a counter.
     */
    getCounter(key: string): number {
        return this.counters.get(key) ?? 0;
    }

    /**
     * Get the current value of a gauge.
     */
    getGauge(key: string): number {
        return this.gauges.get(key) ?? 0;
    }

    /**
     * Returns a point-in-time snapshot of all metrics.
     */
    getSnapshot(): MetricSnapshot {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges)
        };
    }

    /**
     * Clear all accrued metrics.
     */
    clear(): void {
        this.counters.clear();
        this.gauges.clear();
    }
}
