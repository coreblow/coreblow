/**
 * CoreBlow — Config Port Defaults
 *
 * Default port assignments for all gateway services.
 *
 * @packageDocumentation
 */

export const PORT_DEFAULTS = {
    /** Main gateway HTTP port */
    gateway: 3000,
    /** Dashboard UI port (when separate) */
    dashboard: 3001,
    /** WebSocket server port */
    websocket: 3002,
    /** Metrics/observability port */
    metrics: 9090,
    /** Node host port */
    nodeHost: 4000,
    /** MCP bridge port */
    mcp: 4100,
} as const;

/**
 * Resolve a port from env → config → default.
 */
export function resolvePort(service: keyof typeof PORT_DEFAULTS, envVar?: string): number {
    if (envVar) {
        const env = process.env[envVar];
        if (env) {
            const parsed = parseInt(env, 10);
            if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) return parsed;
        }
    }

    return PORT_DEFAULTS[service];
}
