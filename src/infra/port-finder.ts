/**
 * CoreBlow Infra — Port Finder
 *
 * Available port scanning, conflict detection, and default port resolution.
 * Used by the gateway, dashboard, and channel adapters during startup.
 */

import * as net from 'node:net';

/** Default port untuk CoreBlow Gateway — dedicated port, tidak konflik dengan dev server (e.g. Vite 5173, CRA 3000).
 *  Pola: identik dengan CoreBlow yang pakai DEFAULT_GATEWAY_PORT = 18789 (src/config/paths.ts).
 */
export const DEFAULT_GATEWAY_PORT = 3100;

/** Default port assignments per service */
export const DEFAULT_PORTS = {
    gateway: DEFAULT_GATEWAY_PORT, // 3100
    dashboard: 3101,
    websocket: 3102,
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
    startPort: number = DEFAULT_GATEWAY_PORT,
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

// ---------------------------------------------------------------------------
// PortFinderService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class PortFinderService {
  [Symbol.toStringTag] = 'PortFinderService';
}


const { getInstance: getPortFinderService, __testing: __testing_portFinder } =
  createStandaloneSingleton({ create: () => new PortFinderService(), defaultDeps: {} });

export { getPortFinderService, __testing_portFinder };
