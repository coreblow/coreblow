/**
 * CoreBlow — Gateway Maintenance Timers
 *
 * Periodic background tasks that keep the gateway healthy:
 *   - Tick keepalive (30s) — heartbeat to connected clients
 *   - Health refresh (5min) — refresh cached health snapshot
 *   - Dedupe cache pruning (60s) — remove stale message dedup entries
 *   - Chat abort sweep (60s) — clean up timed-out chat runs
 *   - Media cleanup (1hr) — remove old media files
 *
 * Follows OpenClaw's server-maintenance.ts pattern.
 *
 * @packageDocumentation
 */

import {
    DEDUPE_MAX,
    DEDUPE_TTL_MS,
    HEALTH_REFRESH_INTERVAL_MS,
    TICK_INTERVAL_MS,
} from './server-constants.js';

// ─── Types ───────────────────────────────────────────────────────

export type DedupeEntry = {
    ts: number;
    id?: string;
};

export type MaintenanceTimerHandles = {
    tickInterval: ReturnType<typeof setInterval>;
    healthInterval: ReturnType<typeof setInterval>;
    dedupeCleanup: ReturnType<typeof setInterval>;
    mediaCleanup: ReturnType<typeof setInterval> | null;
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Start all gateway maintenance timers.
 * Returns handles for cleanup on shutdown.
 */
export function startGatewayMaintenanceTimers(params: {
    broadcast: (
        event: string,
        payload: unknown,
        opts?: { dropIfSlow?: boolean },
    ) => void;
    refreshGatewayHealthSnapshot: (opts?: { probe?: boolean }) => Promise<unknown>;
    logHealth: { error: (msg: string) => void };
    dedupe: Map<string, DedupeEntry>;
    chatAbortControllers?: Map<string, { expiresAtMs: number; sessionKey?: string }>;
    chatRunBuffers?: Map<string, string>;
    mediaCleanupTtlMs?: number;
}): MaintenanceTimerHandles {
    // ─── 1. Periodic keepalive tick ──────────────────────────────
    const tickInterval = setInterval(() => {
        const payload = { ts: Date.now() };
        params.broadcast('tick', payload, { dropIfSlow: true });
    }, TICK_INTERVAL_MS);

    // ─── 2. Periodic health refresh ─────────────────────────────
    const healthInterval = setInterval(() => {
        void params
            .refreshGatewayHealthSnapshot({ probe: true })
            .catch((err) => params.logHealth.error(`health refresh failed: ${String(err)}`));
    }, HEALTH_REFRESH_INTERVAL_MS);

    // Prime cache so first client gets a snapshot without waiting.
    void params
        .refreshGatewayHealthSnapshot({ probe: true })
        .catch((err) => params.logHealth.error(`initial health refresh failed: ${String(err)}`));

    // ─── 3. Dedupe cache pruning ────────────────────────────────
    const dedupeCleanup = setInterval(() => {
        const now = Date.now();

        // Remove expired entries
        for (const [k, v] of params.dedupe) {
            if (now - v.ts > DEDUPE_TTL_MS) {
                params.dedupe.delete(k);
            }
        }

        // Enforce max size (remove oldest first)
        if (params.dedupe.size > DEDUPE_MAX) {
            const entries = [...params.dedupe.entries()].sort((a, b) => a[1].ts - b[1].ts);
            for (let i = 0; i < params.dedupe.size - DEDUPE_MAX; i++) {
                params.dedupe.delete(entries[i]![0]);
            }
        }

        // Sweep expired chat abort controllers
        if (params.chatAbortControllers) {
            for (const [runId, entry] of params.chatAbortControllers) {
                if (now > entry.expiresAtMs) {
                    params.chatAbortControllers.delete(runId);
                    params.chatRunBuffers?.delete(runId);
                }
            }
        }
    }, 60_000);

    // ─── 4. Media cleanup ───────────────────────────────────────
    let mediaCleanup: ReturnType<typeof setInterval> | null = null;

    if (typeof params.mediaCleanupTtlMs === 'number' && params.mediaCleanupTtlMs > 0) {
        let mediaCleanupInFlight: Promise<void> | null = null;

        const runMediaCleanup = () => {
            if (mediaCleanupInFlight) {
                return mediaCleanupInFlight;
            }
            mediaCleanupInFlight = Promise.resolve()
                .then(async () => {
                    // Placeholder: actual media cleanup would scan $COREBLOW_MEDIA_DIR
                    // and remove files older than mediaCleanupTtlMs
                })
                .catch((err) => {
                    params.logHealth.error(`media cleanup failed: ${String(err)}`);
                })
                .finally(() => {
                    mediaCleanupInFlight = null;
                });
            return mediaCleanupInFlight;
        };

        mediaCleanup = setInterval(() => {
            void runMediaCleanup();
        }, 60 * 60_000); // 1 hour

        // Run cleanup once on startup
        void runMediaCleanup();
    }

    return { tickInterval, healthInterval, dedupeCleanup, mediaCleanup };
}

/**
 * Stop all maintenance timers.
 */
export function stopMaintenanceTimers(handles: MaintenanceTimerHandles): void {
    clearInterval(handles.tickInterval);
    clearInterval(handles.healthInterval);
    clearInterval(handles.dedupeCleanup);
    if (handles.mediaCleanup) {
        clearInterval(handles.mediaCleanup);
    }
}
