/**
 * CoreBlow — Health Dashboard
 *
 * Aggregates health from all subsystems into a unified
 * dashboard with status indicators, dependency checks,
 * uptime tracking, and health history.
 */

/** Service health */
export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    latencyMs?: number;
    message?: string;
    lastCheck: number;
    uptime?: number;
    metadata?: Record<string, unknown>;
}

/** Health check function */
export type HealthCheck = () => Promise<ServiceHealth> | ServiceHealth;

/** Dashboard snapshot */
export interface HealthSnapshot {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    timestamp: number;
    uptimeMs: number;
}

/**
 * CoreBlow Health Dashboard
 */
export class HealthDashboard {
    private checks = new Map<string, HealthCheck>();
    private results = new Map<string, ServiceHealth>();
    private history: HealthSnapshot[] = [];
    private maxHistory = 100;
    private startTime = Date.now();

    /**
     * Register a health check.
     */
    register(name: string, check: HealthCheck): void {
        this.checks.set(name, check);
    }

    /**
     * Run all health checks.
     */
    async checkAll(): Promise<HealthSnapshot> {
        const services: ServiceHealth[] = [];

        for (const [name, check] of Array.from(this.checks)) {
            try {
                const result = await check();
                result.lastCheck = Date.now();
                services.push(result);
                this.results.set(name, result);
            } catch (err) {
                const result: ServiceHealth = {
                    name, status: 'unhealthy',
                    message: err instanceof Error ? err.message : String(err),
                    lastCheck: Date.now(),
                };
                services.push(result);
                this.results.set(name, result);
            }
        }

        const overall = this.computeOverall(services);
        const snapshot: HealthSnapshot = {
            overall, services, timestamp: Date.now(),
            uptimeMs: Date.now() - this.startTime,
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);

        return snapshot;
    }

    /**
     * Get last known status for a service.
     */
    getService(name: string): ServiceHealth | null {
        return this.results.get(name) ?? null;
    }

    /**
     * Get current overall status.
     */
    getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
        if (this.results.size === 0) return 'unknown';
        return this.computeOverall(Array.from(this.results.values()));
    }

    /**
     * Get uptime in ms.
     */
    getUptime(): number {
        return Date.now() - this.startTime;
    }

    /**
     * Get health history.
     */
    getHistory(limit?: number): HealthSnapshot[] {
        return this.history.slice(-(limit ?? 20));
    }

    /**
     * List all registered checks.
     */
    list(): string[] {
        return Array.from(this.checks.keys());
    }

    /** Count */
    count(): number { return this.checks.size; }

    // === Private ===

    private computeOverall(services: ServiceHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
        if (services.some((s) => s.status === 'unhealthy')) return 'unhealthy';
        if (services.some((s) => s.status === 'degraded')) return 'degraded';
        return 'healthy';
    }
}
