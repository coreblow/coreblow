/**
 * CoreBlow — Performance Monitor
 *
 * Provides high-resolution timing utilities to measure
 * sub-millisecond latencies for hot-path analysis.
 */

export interface TimingStats {
    count: number;
    totalMs: number;
    meanMs: number;
    minMs: number;
    maxMs: number;
}

/**
 * CoreBlow Performance Monitor
 */
export class PerformanceMonitor {
    private timings = new Map<string, number[]>();

    /**
     * Start a timer. Returns a function to stop the timer and record it.
     */
    startTimer(label: string): () => number {
        const start = performance.now();
        return () => {
            const end = performance.now();
            const duration = end - start;
            this.record(label, duration);
            return duration;
        };
    }

    /**
     * Wraps an async function and measures its execution time.
     */
    async monitorAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        const stop = this.startTimer(label);
        try {
            return await fn();
        } finally {
            stop();
        }
    }

    /**
     * Wraps a synchronous function and measures its execution time.
     */
    monitorSync<T>(label: string, fn: () => T): T {
        const stop = this.startTimer(label);
        try {
            return fn();
        } finally {
            stop();
        }
    }

    /**
     * Get statistics for a specific label.
     */
    getStats(label: string): TimingStats | null {
        const records = this.timings.get(label);
        if (!records || records.length === 0) return null;

        const count = records.length;
        let total = 0;
        let min = records[0];
        let max = records[0];

        for (const val of records) {
            total += val;
            if (val < min) min = val;
            if (val > max) max = val;
        }

        return {
            count,
            totalMs: total,
            meanMs: total / count,
            minMs: min,
            maxMs: max
        };
    }

    /**
     * Get aggregate statistics for all tracked labels.
     */
    getAllStats(): Record<string, TimingStats> {
        const result: Record<string, TimingStats> = {};
        for (const label of this.timings.keys()) {
            const stats = this.getStats(label);
            if (stats) result[label] = stats;
        }
        return result;
    }

    /**
     * Clear recorded timings.
     */
    clear(): void {
        this.timings.clear();
    }

    // === Private ===

    private record(label: string, durationMs: number): void {
        const arr = this.timings.get(label);
        if (arr) {
            arr.push(durationMs);
            // Cap at 10,000 records per label to prevent memory leaks in long-running processes
            if (arr.length > 10000) {
                arr.shift();
            }
        } else {
            this.timings.set(label, [durationMs]);
        }
    }
}
