/**
 * CoreBlow Health Check Endpoints
 *
 * Comprehensive health check system with liveness, readiness, and
 * dependency checks. Supports custom probes and status aggregation.
 *
 * Equivalent: CoreBlow gateway health patterns (~350 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('gateway:health');

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
    status: HealthStatus;
    uptime: number;
    timestamp: number;
    version: string;
    checks: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
    status: HealthStatus;
    message?: string;
    latencyMs?: number;
    lastChecked: number;
    metadata?: Record<string, unknown>;
}

export type HealthProbe = () => Promise<ComponentHealth>;

const probes = new Map<string, HealthProbe>();
const startTime = Date.now();
let appVersion = '1.0.0';

export function setVersion(version: string): void { appVersion = version; }

export function registerProbe(name: string, probe: HealthProbe): void {
    probes.set(name, probe);
}

export function removeProbe(name: string): boolean {
    return probes.delete(name);
}

export function clearProbes(): void { probes.clear(); }

export async function checkHealth(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};
    let overallStatus: HealthStatus = 'healthy';

    for (const [name, probe] of probes) {
        try {
            const start = Date.now();
            const result = await probe();
            result.latencyMs = result.latencyMs ?? (Date.now() - start);
            result.lastChecked = Date.now();
            checks[name] = result;

            if (result.status === 'unhealthy') overallStatus = 'unhealthy';
            else if (result.status === 'degraded' && overallStatus !== 'unhealthy') overallStatus = 'degraded';
        } catch (err) {
            checks[name] = {
                status: 'unhealthy',
                message: err instanceof Error ? err.message : String(err),
                lastChecked: Date.now(),
            };
            overallStatus = 'unhealthy';
        }
    }

    return {
        status: overallStatus,
        uptime: Date.now() - startTime,
        timestamp: Date.now(),
        version: appVersion,
        checks,
    };
}

export async function checkLiveness(): Promise<{ alive: boolean }> {
    return { alive: true };
}

export async function checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
    const health = await checkHealth();
    return {
        ready: health.status !== 'unhealthy',
        reason: health.status === 'unhealthy' ? 'One or more checks failed' : undefined,
    };
}

// Built-in probes
export function createMemoryProbe(maxHeapMB: number = 512): HealthProbe {
    return async () => {
        const used = process.memoryUsage();
        const heapMB = Math.round(used.heapUsed / 1024 / 1024);
        return {
            status: heapMB > maxHeapMB ? 'degraded' : 'healthy',
            message: `Heap: ${heapMB}MB / ${maxHeapMB}MB`,
            lastChecked: Date.now(),
            metadata: { heapUsedMB: heapMB, rss: Math.round(used.rss / 1024 / 1024) },
        };
    };
}

export function createUptimeProbe(minUptimeMs: number = 5000): HealthProbe {
    return async () => {
        const uptime = Date.now() - startTime;
        return {
            status: uptime < minUptimeMs ? 'degraded' : 'healthy',
            message: `Uptime: ${Math.round(uptime / 1000)}s`,
            lastChecked: Date.now(),
            metadata: { uptimeMs: uptime },
        };
    };
}

export function createEventLoopProbe(maxDelayMs: number = 100): HealthProbe {
    return async () => {
        const start = Date.now();
        await new Promise((resolve) => setImmediate(resolve));
        const delay = Date.now() - start;
        return {
            status: delay > maxDelayMs ? 'degraded' : 'healthy',
            message: `Event loop delay: ${delay}ms`,
            latencyMs: delay,
            lastChecked: Date.now(),
        };
    };
}
