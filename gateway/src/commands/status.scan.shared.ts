/**
 * commands/status.scan.shared.ts
 * Status scanning logic shared between CLI status command & gateway health endpoint.
 */

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type ServiceScanResult = {
    name: string;
    status: ServiceStatus;
    latencyMs?: number;
    error?: string;
};

/** Determine overall status from individual service results. */
export function aggregateStatus(results: ServiceScanResult[]): ServiceStatus {
    if (results.length === 0) return 'unknown';
    if (results.every(r => r.status === 'healthy')) return 'healthy';
    if (results.some(r => r.status === 'unhealthy')) return 'unhealthy';
    return 'degraded';
}

/** Format scan results for display. */
export function formatScanResults(results: ServiceScanResult[]): string {
    return results.map(r => {
        const icon = r.status === 'healthy' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌';
        const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : '';
        return `${icon} ${r.name}: ${r.status}${latency}${r.error ? ` — ${r.error}` : ''}`;
    }).join('\n');
}
