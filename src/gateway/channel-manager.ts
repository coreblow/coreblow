/**
 * CoreBlow — Channel Lifecycle Manager
 *
 * Manages the lifecycle of all registered channel adapters:
 * connect, health-monitor, auto-restart with backoff, and graceful stop.
 *
 * Inspired by CoreBlow's `server-channels.ts` pattern but built on
 * CoreBlow's own `ChannelAdapter` interface and `ChannelBridge`.
 *
 * Key differences from CoreBlow:
 * - Uses CoreBlow's unified ChannelAdapter interface (not plugin-based)
 * - Stores adapter instances directly (not plugin gateway hooks)
 * - Integrates with CoreBlow's ChannelBridge for message routing
 *
 * @packageDocumentation
 */

import {
    type ChannelAdapter,
    type ChannelConfig,
    type ChannelId,
    type ChannelMessage,
    getAdapter,
    listAdapters,
} from '../channels/adapter.js';
import { loadConfig, type CoreBlowConfig } from '../config/config.js';

// ─── Backoff Constants ───────────────────────────────────────────

const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const BACKOFF_FACTOR = 2;
const BACKOFF_JITTER = 0.1;
const MAX_RESTART_ATTEMPTS = 10;

// ─── Types ───────────────────────────────────────────────────────

/** Per-adapter runtime state tracked by the manager */
export interface ChannelState {
    channelId: ChannelId;
    running: boolean;
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    restartPending: boolean;
    restartAttempts: number;
    lastStartAt: number | null;
    lastStopAt: number | null;
    lastError: string | null;
    manuallyStopped: boolean;
}

/** Snapshot of all channel states for health/status endpoints */
export type ChannelSnapshot = Partial<Record<ChannelId, ChannelState>>;

/** Callback invoked when a channel delivers an inbound message */
export type InboundHandler = (msg: ChannelMessage) => void;

export interface ChannelManagerOptions {
    /** Resolve latest config (hot-reload safe) */
    loadConfig: () => CoreBlowConfig;
    /** Callback for inbound messages from any channel */
    onInbound: InboundHandler;
    /** Optional logger */
    log?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
    };
}

// ─── Backoff Helper ──────────────────────────────────────────────

function computeBackoff(attempt: number): number {
    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(BACKOFF_FACTOR, attempt - 1), MAX_BACKOFF_MS);
    const jitter = delay * BACKOFF_JITTER * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}

// ─── Channel Manager Factory ────────────────────────────────────

export interface ChannelManager {
    /** Start all enabled channels from config */
    startAll(): Promise<void>;
    /** Start a specific channel by ID */
    start(channelId: ChannelId): Promise<void>;
    /** Stop a specific channel (or all if no ID) */
    stop(channelId?: ChannelId): Promise<void>;
    /** Get state snapshot for all channels */
    getSnapshot(): ChannelSnapshot;
    /** Get state for a specific channel */
    getState(channelId: ChannelId): ChannelState | null;
}

/**
 * Create a channel lifecycle manager.
 *
 * This is the central orchestrator that connects registered
 * ChannelAdapters to the gateway runtime.
 */
export function createChannelManager(opts: ChannelManagerOptions): ChannelManager {
    const { onInbound, log } = opts;

    // Per-channel runtime tracking
    const states = new Map<ChannelId, ChannelState>();
    const aborts = new Map<ChannelId, AbortController>();

    // ── State Helpers ────────────────────────────────────────────

    function getOrCreateState(channelId: ChannelId): ChannelState {
        const existing = states.get(channelId);
        if (existing) return existing;

        const initial: ChannelState = {
            channelId,
            running: false,
            enabled: false,
            configured: false,
            connected: false,
            restartPending: false,
            restartAttempts: 0,
            lastStartAt: null,
            lastStopAt: null,
            lastError: null,
            manuallyStopped: false,
        };
        states.set(channelId, initial);
        return initial;
    }

    function updateState(channelId: ChannelId, patch: Partial<ChannelState>): ChannelState {
        const state = getOrCreateState(channelId);
        Object.assign(state, patch);
        return state;
    }

    // ── Config Resolution ────────────────────────────────────────

    function resolveChannelConfig(channelId: ChannelId): ChannelConfig | null {
        const cfg = opts.loadConfig();
        const channelCfg = (cfg as Record<string, unknown>).channels as
            | Record<string, ChannelConfig>
            | undefined;

        if (!channelCfg?.[channelId]) return null;
        return channelCfg[channelId];
    }

    function isChannelEnabled(channelId: ChannelId): boolean {
        const config = resolveChannelConfig(channelId);
        return config?.enabled === true;
    }

    function isChannelConfigured(channelId: ChannelId): boolean {
        const config = resolveChannelConfig(channelId);
        if (!config) return false;
        // A channel is considered configured if it has a token or apiKey
        return !!(config.token || config.apiKey || config.webhookUrl);
    }

    // ── Single Channel Lifecycle ─────────────────────────────────

    async function startSingleChannel(channelId: ChannelId): Promise<void> {
        const adapter = getAdapter(channelId);
        if (!adapter) {
            log?.warn(`[${channelId}] no registered adapter — skipping`);
            return;
        }

        const config = resolveChannelConfig(channelId);
        if (!config) {
            updateState(channelId, {
                enabled: false,
                configured: false,
                running: false,
                lastError: 'no config found',
            });
            return;
        }

        if (!config.enabled) {
            updateState(channelId, {
                enabled: false,
                configured: isChannelConfigured(channelId),
                running: false,
                lastError: 'disabled in config',
            });
            return;
        }

        if (!isChannelConfigured(channelId)) {
            updateState(channelId, {
                enabled: true,
                configured: false,
                running: false,
                lastError: 'not configured (missing token/apiKey)',
            });
            return;
        }

        // Cancel any previous abort for this channel
        aborts.get(channelId)?.abort();
        const abort = new AbortController();
        aborts.set(channelId, abort);

        updateState(channelId, {
            enabled: true,
            configured: true,
            running: true,
            restartPending: false,
            lastStartAt: Date.now(),
            lastError: null,
            manuallyStopped: false,
        });

        log?.info(`[${channelId}] starting channel adapter...`);

        try {
            // Wire inbound message handler
            adapter.onMessage((msg: ChannelMessage) => {
                try {
                    onInbound(msg);
                } catch (err) {
                    log?.error(`[${channelId}] inbound handler error: ${err instanceof Error ? err.message : String(err)}`);
                }
            });

            // Connect adapter
            await adapter.connect(config);

            // Reset restart counter on successful connect
            updateState(channelId, {
                connected: true,
                restartAttempts: 0,
            });

            log?.info(`[${channelId}] connected successfully`);

        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log?.error(`[${channelId}] startup failed: ${message}`);

            updateState(channelId, {
                running: false,
                connected: false,
                lastError: message,
                lastStopAt: Date.now(),
            });

            // Schedule auto-restart
            await scheduleRestart(channelId, abort.signal);
        }
    }

    // ── Auto-Restart with Backoff ────────────────────────────────

    async function scheduleRestart(channelId: ChannelId, signal: AbortSignal): Promise<void> {
        const state = getOrCreateState(channelId);
        if (state.manuallyStopped) return;

        const attempt = state.restartAttempts + 1;
        if (attempt > MAX_RESTART_ATTEMPTS) {
            log?.error(`[${channelId}] giving up after ${MAX_RESTART_ATTEMPTS} restart attempts`);
            updateState(channelId, {
                restartPending: false,
                restartAttempts: attempt,
            });
            return;
        }

        const delayMs = computeBackoff(attempt);
        log?.info(`[${channelId}] auto-restart attempt ${attempt}/${MAX_RESTART_ATTEMPTS} in ${Math.round(delayMs / 1000)}s`);

        updateState(channelId, {
            restartPending: true,
            restartAttempts: attempt,
        });

        try {
            await sleep(delayMs, signal);
            if (signal.aborted) return;

            // Re-attempt start
            await startSingleChannel(channelId);
        } catch {
            // Abort or failure — restart chain stops
        }
    }

    // ── Stop Channel ─────────────────────────────────────────────

    async function stopSingleChannel(channelId: ChannelId): Promise<void> {
        const adapter = getAdapter(channelId);
        const abort = aborts.get(channelId);

        // Mark as manually stopped so auto-restart doesn't fire
        updateState(channelId, { manuallyStopped: true });

        // Cancel any pending restart
        abort?.abort();
        aborts.delete(channelId);

        // Disconnect adapter
        if (adapter) {
            try {
                await adapter.disconnect();
            } catch (err) {
                log?.warn(`[${channelId}] disconnect error: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        updateState(channelId, {
            running: false,
            connected: false,
            restartPending: false,
            lastStopAt: Date.now(),
        });

        log?.info(`[${channelId}] stopped`);
    }

    // ── Public API ───────────────────────────────────────────────

    const manager: ChannelManager = {
        async startAll(): Promise<void> {
            const adapters = listAdapters();
            log?.info(`starting ${adapters.length} registered channel adapters...`);

            for (const adapter of adapters) {
                try {
                    await startSingleChannel(adapter.id);
                } catch (err) {
                    log?.error(`[${adapter.id}] channel startup failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        },

        async start(channelId: ChannelId): Promise<void> {
            await startSingleChannel(channelId);
        },

        async stop(channelId?: ChannelId): Promise<void> {
            if (channelId) {
                await stopSingleChannel(channelId);
            } else {
                // Stop all
                const ids = Array.from(states.keys());
                await Promise.all(ids.map(id => stopSingleChannel(id)));
            }
        },

        getSnapshot(): ChannelSnapshot {
            const snapshot: ChannelSnapshot = {};
            for (const [id, state] of states) {
                snapshot[id] = { ...state };
            }
            return snapshot;
        },

        getState(channelId: ChannelId): ChannelState | null {
            return states.get(channelId) ?? null;
        },
    };

    return manager;
}
