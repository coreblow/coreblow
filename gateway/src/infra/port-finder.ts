/**
 * CoreBlow Infra — Port Finder
 *
 * Available port scanning, conflict detection, and default port resolution.
 * Used by the gateway, dashboard, and channel adapters during startup.
 */

import * as net from 'node:net';

/** Default port assignments */
export const DEFAULT_PORTS = {
    gateway: 3000,
    dashboard: 3001,
    websocket: 3002,
    playwright: 19003,
    metrics: 9090,
} as const;

/**
 * Check if a port is available.
 */
export function isPortAvailable(port: number, host: string = '0.0.0.0'): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, host);
    });
}

/**
 * Find an available port starting from the given port.
 * Scans up to maxAttempts ports sequentially.
 */
export async function findAvailablePort(
    startPort: number = 3000,
    opts?: { host?: string; maxAttempts?: number },
): Promise<number> {
    const host = opts?.host ?? '0.0.0.0';
    const maxAttempts = opts?.maxAttempts ?? 100;

    for (let offset = 0; offset < maxAttempts; offset++) {
        const port = startPort + offset;
        if (await isPortAvailable(port, host)) {
            return port;
        }
    }

    throw new Error(`No available port found after scanning ${startPort}–${startPort + maxAttempts - 1}`);
}

/**
 * Resolve the port for a service, checking availability.
 * Falls back to finding the next available port if the default is taken.
 */
export async function resolvePort(
    service: keyof typeof DEFAULT_PORTS,
    configuredPort?: number,
): Promise<number> {
    const port = configuredPort ?? DEFAULT_PORTS[service];

    if (await isPortAvailable(port)) {
        return port;
    }

    // Default is taken — find next available
    return findAvailablePort(port + 1);
}

/**
 * Check multiple ports and return their availability status.
 */
export async function checkPorts(
    ports: number[],
    host: string = '0.0.0.0',
): Promise<Record<number, boolean>> {
    const results: Record<number, boolean> = {};

    await Promise.all(
        ports.map(async (port) => {
            results[port] = await isPortAvailable(port, host);
        }),
    );

    return results;
}
