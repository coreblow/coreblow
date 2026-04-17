/**
 * CoreBlow Health Aggregator
 *
 * Aggregates health status from all subsystems (gateway, channels,
 * agents, cron, plugins) into a unified health report. Supports
 * component-level health checks, degradation detection, and
 * dashboard-ready status output.
 */

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/** Individual component health check */
export interface ComponentHealth {
    name: string;
    status: HealthStatus;
    latencyMs?: number;
    message?: string;
    lastCheckedAt: number;
    metadata?: Record<string, unknown>;
}

/** Aggregated system health */
export interface SystemHealth {
    status: HealthStatus;
    uptime: number;
    uptimeFormatted: string;
    components: ComponentHealth[];
    timestamp: number;
    version: string;
    memory: { rss: number; heapUsed: number; heapTotal: number };
}

/** Health check function */
export type HealthCheck = () => Promise<ComponentHealth>;

/**
 * CoreBlow Health Aggregator
 */
export class HealthAggregator {
    private checks = new Map<string, HealthCheck>();
    private cache = new Map<string, ComponentHealth>();
    private cacheTtlMs = 10_000; // 10 seconds
    private version: string;

    constructor(version: string = '1.0.0') {
        this.version = version;
    }

    /**
     * Register a health check for a component.
     */
    register(name: string, check: HealthCheck): void {
        this.checks.set(name, check);
    }

    /**
     * Run all health checks and aggregate results.
     */
    async check(): Promise<SystemHealth> {
        const components: ComponentHealth[] = [];

        for (const [name, checkFn] of Array.from(this.checks)) {
            // Check cache
            const cached = this.cache.get(name);
            if (cached && Date.now() - cached.lastCheckedAt < this.cacheTtlMs) {
                components.push(cached);
                continue;
            }

            try {
                const start = Date.now();
                const result = await Promise.race([
                    checkFn(),
                    this.timeout(5000, name),
                ]);
                result.latencyMs = result.latencyMs ?? Date.now() - start;
                this.cache.set(name, result);
                components.push(result);
            } catch (err) {
                const fallback: ComponentHealth = {
                    name,
                    status: 'unhealthy',
                    message: err instanceof Error ? err.message : 'Check failed',
                    lastCheckedAt: Date.now(),
                };
                this.cache.set(name, fallback);
                components.push(fallback);
            }
        }

        const overallStatus = this.aggregateStatus(components);
        const mem = process.memoryUsage();

        return {
            status: overallStatus,
            uptime: process.uptime(),
            uptimeFormatted: this.formatUptime(process.uptime()),
            components,
            timestamp: Date.now(),
            version: this.version,
            memory: {
                rss: mem.rss,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
            },
        };
    }

    /**
     * Quick health check — returns overall status without details.
     */
    async ping(): Promise<{ status: HealthStatus; uptime: number }> {
        const health = await this.check();
        return { status: health.status, uptime: health.uptime };
    }

    /**
     * Register standard built-in checks.
     */
    registerDefaults(): void {
        // Memory check
        this.register('memory', async () => {
            const mem = process.memoryUsage();
            const heapPercent = mem.heapUsed / mem.heapTotal;
            return {
                name: 'memory',
                status: heapPercent > 0.95 ? 'unhealthy' : heapPercent > 0.8 ? 'degraded' : 'healthy',
                message: `${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB (${Math.round(heapPercent * 100)}%)`,
                lastCheckedAt: Date.now(),
                metadata: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
            };
        });

        // Event loop check
        this.register('event-loop', async () => {
            const start = Date.now();
            await new Promise((r) => setImmediate(r));
            const lag = Date.now() - start;
            return {
                name: 'event-loop',
                status: lag > 100 ? 'degraded' : 'healthy',
                latencyMs: lag,
                message: `Event loop lag: ${lag}ms`,
                lastCheckedAt: Date.now(),
            };
        });
    }

    // === Private ===

    private aggregateStatus(components: ComponentHealth[]): HealthStatus {
        if (components.length === 0) return 'unknown';
        if (components.some((c) => c.status === 'unhealthy')) return 'unhealthy';
        if (components.some((c) => c.status === 'degraded')) return 'degraded';
        if (components.every((c) => c.status === 'healthy')) return 'healthy';
        return 'degraded';
    }

    private formatUptime(seconds: number): string {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const parts: string[] = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);
        return parts.join(' ');
    }

    private timeout(ms: number, name: string): Promise<ComponentHealth> {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Health check "${name}" timed out after ${ms}ms`)), ms),
        );
    }
}
