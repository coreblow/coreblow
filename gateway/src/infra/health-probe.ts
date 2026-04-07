/**
 * CoreBlow — Health Probe
 *
 * Runs periodic health checks against registered
 * endpoints/services with configurable intervals,
 * thresholds, and alerting.
 */

/** Probe target */
export interface ProbeTarget {
    name: string;
    checker: () => Promise<boolean>;
    intervalMs: number;
    failureThreshold: number;
    status: 'healthy' | 'unhealthy' | 'unknown';
    consecutiveFailures: number;
    lastChecked?: number;
    lastHealthy?: number;
}

/** Probe result */
export interface ProbeResult {
    name: string;
    healthy: boolean;
    timestamp: number;
    durationMs: number;
}

/**
 * CoreBlow Health Probe
 */
export class HealthProbe {
    private targets = new Map<string, ProbeTarget>();
    private history: ProbeResult[] = [];
    private maxHistory = 1000;

    /**
     * Register a probe target.
     */
    register(name: string, checker: () => Promise<boolean>, intervalMs: number = 30_000, failureThreshold: number = 3): void {
        this.targets.set(name, { name, checker, intervalMs, failureThreshold, status: 'unknown', consecutiveFailures: 0 });
    }

    /**
     * Run probe for a target.
     */
    async probe(name: string): Promise<ProbeResult> {
        const target = this.targets.get(name);
        if (!target) return { name, healthy: false, timestamp: Date.now(), durationMs: 0 };

        const start = Date.now();
        let healthy = false;
        try {
            healthy = await target.checker();
        } catch {
            healthy = false;
        }

        const result: ProbeResult = { name, healthy, timestamp: Date.now(), durationMs: Date.now() - start };
        target.lastChecked = result.timestamp;

        if (healthy) {
            target.consecutiveFailures = 0;
            target.status = 'healthy';
            target.lastHealthy = result.timestamp;
        } else {
            target.consecutiveFailures++;
            if (target.consecutiveFailures >= target.failureThreshold) target.status = 'unhealthy';
        }

        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
        return result;
    }

    /**
     * Run all probes.
     */
    async probeAll(): Promise<ProbeResult[]> {
        const results: ProbeResult[] = [];
        for (const name of Array.from(this.targets.keys())) {
            results.push(await this.probe(name));
        }
        return results;
    }

    /**
     * Get overall health.
     */
    getOverallHealth(): { healthy: boolean; targets: Array<{ name: string; status: string }> } {
        const targets = Array.from(this.targets.values()).map((t) => ({ name: t.name, status: t.status }));
        return { healthy: targets.every((t) => t.status !== 'unhealthy'), targets };
    }

    /**
     * Get target status.
     */
    getTarget(name: string): ProbeTarget | null { return this.targets.get(name) ?? null; }

    /** Count */
    count(): number { return this.targets.size; }
}
