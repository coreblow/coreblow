/**
 * CoreBlow — Access Log
 *
 * HTTP-style access logging for all gateway requests.
 * Supports structured logging, filtering, export,
 * and real-time stats computation.
 */

/** Access entry */
export interface AccessEntry {
    id: string;
    method: string;
    path: string;
    statusCode: number;
    userId?: string;
    ip?: string;
    userAgent?: string;
    durationMs: number;
    bytesIn?: number;
    bytesOut?: number;
    timestamp: number;
}

/** Access stats */
export interface AccessStats {
    totalRequests: number;
    averageLatencyMs: number;
    errorRate: number;
    topPaths: Array<{ path: string; count: number }>;
    statusCodes: Record<number, number>;
}

/**
 * CoreBlow Access Log
 */
export class AccessLog {
    private entries: AccessEntry[] = [];
    private maxEntries = 10_000;
    private idCounter = 0;

    /**
     * Log an access entry.
     */
    log(method: string, path: string, statusCode: number, durationMs: number, opts?: Partial<AccessEntry>): AccessEntry {
        const entry: AccessEntry = {
            id: `acc-${++this.idCounter}`, method, path, statusCode, durationMs,
            userId: opts?.userId, ip: opts?.ip, userAgent: opts?.userAgent,
            bytesIn: opts?.bytesIn, bytesOut: opts?.bytesOut,
            timestamp: Date.now(),
        };
        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) this.entries = this.entries.slice(-this.maxEntries);
        return entry;
    }

    /**
     * Get recent entries.
     */
    getRecent(limit?: number): AccessEntry[] {
        return this.entries.slice(-(limit ?? 50));
    }

    /**
     * Filter by path.
     */
    getByPath(path: string): AccessEntry[] {
        return this.entries.filter((e) => e.path === path);
    }

    /**
     * Filter by user.
     */
    getByUser(userId: string): AccessEntry[] {
        return this.entries.filter((e) => e.userId === userId);
    }

    /**
     * Filter by status code range.
     */
    getByStatus(min: number, max: number): AccessEntry[] {
        return this.entries.filter((e) => e.statusCode >= min && e.statusCode <= max);
    }

    /**
     * Compute stats for a time window.
     */
    getStats(windowMs?: number): AccessStats {
        const cutoff = windowMs ? Date.now() - windowMs : 0;
        const filtered = this.entries.filter((e) => e.timestamp >= cutoff);

        const pathCounts: Record<string, number> = {};
        const statusCodes: Record<number, number> = {};
        let totalLatency = 0;
        let errors = 0;

        for (const entry of filtered) {
            pathCounts[entry.path] = (pathCounts[entry.path] ?? 0) + 1;
            statusCodes[entry.statusCode] = (statusCodes[entry.statusCode] ?? 0) + 1;
            totalLatency += entry.durationMs;
            if (entry.statusCode >= 400) errors++;
        }

        const topPaths = Object.entries(pathCounts)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalRequests: filtered.length,
            averageLatencyMs: filtered.length > 0 ? totalLatency / filtered.length : 0,
            errorRate: filtered.length > 0 ? errors / filtered.length : 0,
            topPaths,
            statusCodes,
        };
    }

    /**
     * Clear old entries.
     */
    clear(): void {
        this.entries = [];
    }

    /** Count */
    count(): number { return this.entries.length; }
}
