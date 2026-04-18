/**
 * CoreBlow — Gateway Graceful Shutdown
 *
 * Creates a comprehensive close handler that shuts down all gateway
 * subsystems in the correct order. Follows OpenClaw's server-close.ts:
 *
 *   1. Stop channels (Discord, Telegram, etc.)
 *   2. Stop plugin services
 *   3. Stop cron scheduler
 *   4. Stop heartbeat runner
 *   5. Clear maintenance timers (tick, health, dedupe, media)
 *   6. Broadcast "shutdown" event to all connected clients
 *   7. Close all WebSocket connections (code 1012 = service restart)
 *   8. Stop config reloader
 *   9. Close WebSocket server
 *  10. Close HTTP server(s) with closeIdleConnections()
 *
 * @packageDocumentation
 */

import type { Server as HttpServer } from 'node:http';
import type { WebSocketServer } from 'ws';
import type { MaintenanceTimerHandles } from './server-maintenance.js';

// ─── Types ───────────────────────────────────────────────────────

export type GatewayCloseHandler = (opts?: {
    reason?: string;
    restartExpectedMs?: number | null;
}) => Promise<void>;

// ─── Public API ──────────────────────────────────────────────────

export function createGatewayCloseHandler(params: {
    /** Broadcast event to all connected WebSocket clients */
    broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
    /** Set of connected WebSocket clients */
    clients: Set<{ socket: { close: (code: number, reason: string) => void } }>;
    /** WebSocket server instance */
    wss: WebSocketServer;
    /** Primary HTTP server */
    httpServer: HttpServer;
    /** Additional HTTP servers (e.g., TLS) */
    httpServers?: HttpServer[];
    /** Maintenance timer handles from startGatewayMaintenanceTimers */
    maintenanceTimers?: MaintenanceTimerHandles | null;
    /** Cron scheduler with stop method */
    cron?: { stop: () => void } | null;
    /** Heartbeat runner with stop method */
    heartbeatRunner?: { stop: () => void } | null;
    /** Config reloader with stop method */
    configReloader?: { stop: () => Promise<void> } | null;
    /** Channel stop function (name → Promise) */
    stopChannel?: (name: string, accountId?: string) => Promise<void>;
    /** List of active channel IDs to stop */
    activeChannelIds?: string[];
    /** Plugin services with stop method */
    pluginServices?: { stop: () => Promise<void> } | null;
    /** Node presence timer handles */
    nodePresenceTimers?: Map<string, ReturnType<typeof setInterval>>;
    /** Agent event subscription unsub */
    agentUnsub?: (() => void) | null;
    /** Heartbeat subscription unsub */
    heartbeatUnsub?: (() => void) | null;
    /** Transcript subscription unsub */
    transcriptUnsub?: (() => void) | null;
    /** Lifecycle subscription unsub */
    lifecycleUnsub?: (() => void) | null;
}): GatewayCloseHandler {
    return async (opts?: { reason?: string; restartExpectedMs?: number | null }) => {
        try {
            const reasonRaw = typeof opts?.reason === 'string' ? opts.reason.trim() : '';
            const reason = reasonRaw || 'gateway stopping';
            const restartExpectedMs =
                typeof opts?.restartExpectedMs === 'number' && Number.isFinite(opts.restartExpectedMs)
                    ? Math.max(0, Math.floor(opts.restartExpectedMs))
                    : null;

            // 1. Stop channels
            if (params.stopChannel && params.activeChannelIds) {
                for (const channelId of params.activeChannelIds) {
                    try {
                        await params.stopChannel(channelId);
                    } catch { /* ignore */ }
                }
            }

            // 2. Stop plugin services
            if (params.pluginServices) {
                await params.pluginServices.stop().catch(() => {});
            }

            // 3. Stop cron scheduler
            if (params.cron) {
                try {
                    params.cron.stop();
                } catch { /* ignore */ }
            }

            // 4. Stop heartbeat runner
            if (params.heartbeatRunner) {
                try {
                    params.heartbeatRunner.stop();
                } catch { /* ignore */ }
            }

            // 5. Clear maintenance timers
            if (params.maintenanceTimers) {
                clearInterval(params.maintenanceTimers.tickInterval);
                clearInterval(params.maintenanceTimers.healthInterval);
                clearInterval(params.maintenanceTimers.dedupeCleanup);
                if (params.maintenanceTimers.mediaCleanup) {
                    clearInterval(params.maintenanceTimers.mediaCleanup);
                }
            }

            // 6. Clear node presence timers
            if (params.nodePresenceTimers) {
                for (const timer of params.nodePresenceTimers.values()) {
                    clearInterval(timer);
                }
                params.nodePresenceTimers.clear();
            }

            // 7. Unsubscribe event handlers
            const unsubs = [
                params.agentUnsub,
                params.heartbeatUnsub,
                params.transcriptUnsub,
                params.lifecycleUnsub,
            ];
            for (const unsub of unsubs) {
                if (unsub) {
                    try { unsub(); } catch { /* ignore */ }
                }
            }

            // 8. Broadcast shutdown event to all connected clients
            params.broadcast('shutdown', { reason, restartExpectedMs });

            // 9. Close all WebSocket clients
            for (const c of params.clients) {
                try {
                    c.socket.close(1012, 'service restart');
                } catch { /* ignore */ }
            }
            params.clients.clear();

            // 10. Stop config reloader
            if (params.configReloader) {
                await params.configReloader.stop().catch(() => {});
            }

            // 11. Close WebSocket server
            await new Promise<void>((resolve) => params.wss.close(() => resolve()));

            // 12. Close HTTP server(s) with closeIdleConnections
            const servers =
                params.httpServers && params.httpServers.length > 0
                    ? params.httpServers
                    : [params.httpServer];

            for (const server of servers) {
                const httpServer = server as HttpServer & {
                    closeIdleConnections?: () => void;
                };
                if (typeof httpServer.closeIdleConnections === 'function') {
                    httpServer.closeIdleConnections();
                }
                await new Promise<void>((resolve, reject) =>
                    httpServer.close((err) => (err ? reject(err) : resolve())),
                );
            }
        } catch (err) {
            // Final safety net — log but don't rethrow during shutdown
            console.error('[coreblow] Error during gateway shutdown:', err);
        }
    };
}
