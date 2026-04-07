/**
 * CoreBlow Infra — Restart Sentinel
 *
 * File-based restart detection and graceful shutdown coordination.
 * When the sentinel file is touched, the daemon process restarts.
 * Includes crash recovery loop with exponential backoff.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Sentinel configuration */
export interface SentinelConfig {
    /** Path to the sentinel file */
    sentinelPath: string;
    /** Polling interval for file change detection (ms) */
    pollIntervalMs?: number;
    /** Maximum restart attempts before giving up */
    maxRestarts?: number;
    /** Base backoff delay (ms) */
    backoffBaseMs?: number;
    /** Maximum backoff delay (ms) */
    backoffMaxMs?: number;
}

/** Sentinel state */
export interface SentinelState {
    active: boolean;
    restartCount: number;
    lastRestartAt?: number;
    lastCheckAt?: number;
}

/**
 * CoreBlow Restart Sentinel
 */
export class RestartSentinel {
    private config: SentinelConfig;
    private state: SentinelState = { active: false, restartCount: 0 };
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private lastMtime: number = 0;
    private onRestartHandler: (() => Promise<void> | void) | null = null;
    private onShutdownHandler: (() => Promise<void> | void) | null = null;

    constructor(config: SentinelConfig) {
        this.config = {
            pollIntervalMs: 2000,
            maxRestarts: 20,
            backoffBaseMs: 1000,
            backoffMaxMs: 30_000,
            ...config,
        };
    }

    /**
     * Start watching for restart signals.
     */
    start(): void {
        if (this.state.active) return;

        // Ensure sentinel file exists
        const dir = path.dirname(this.config.sentinelPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.config.sentinelPath)) {
            fs.writeFileSync(this.config.sentinelPath, String(Date.now()));
        }

        this.lastMtime = this.getFileMtime();
        this.state.active = true;

        this.pollTimer = setInterval(() => {
            this.check();
        }, this.config.pollIntervalMs!);

        // Listen for process signals
        process.on('SIGTERM', () => void this.gracefulShutdown());
        process.on('SIGINT', () => void this.gracefulShutdown());
    }

    /**
     * Stop watching.
     */
    stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.state.active = false;
    }

    /**
     * Register a restart handler.
     */
    onRestart(handler: () => Promise<void> | void): void {
        this.onRestartHandler = handler;
    }

    /**
     * Register a shutdown handler.
     */
    onShutdown(handler: () => Promise<void> | void): void {
        this.onShutdownHandler = handler;
    }

    /**
     * Trigger a restart by touching the sentinel file.
     */
    triggerRestart(): void {
        fs.writeFileSync(this.config.sentinelPath, String(Date.now()));
    }

    /**
     * Get current state.
     */
    getState(): SentinelState {
        return { ...this.state };
    }

    /**
     * Calculate backoff delay for crash recovery.
     */
    getBackoffDelay(): number {
        const base = this.config.backoffBaseMs!;
        const max = this.config.backoffMaxMs!;
        const delay = Math.min(max, base * Math.pow(2, this.state.restartCount));
        // Add jitter (10-30%)
        const jitter = delay * (0.1 + Math.random() * 0.2);
        return Math.floor(delay + jitter);
    }

    // === Private ===

    private check(): void {
        this.state.lastCheckAt = Date.now();

        const currentMtime = this.getFileMtime();
        if (currentMtime > this.lastMtime) {
            this.lastMtime = currentMtime;
            this.state.restartCount++;
            this.state.lastRestartAt = Date.now();

            if (this.state.restartCount > (this.config.maxRestarts ?? 20)) {
                this.stop();
                return;
            }

            if (this.onRestartHandler) {
                void Promise.resolve(this.onRestartHandler()).catch(() => {});
            }
        }
    }

    private async gracefulShutdown(): Promise<void> {
        this.stop();
        if (this.onShutdownHandler) {
            try {
                await this.onShutdownHandler();
            } catch {
                // Shutdown error — exit anyway
            }
        }
        process.exit(0);
    }

    private getFileMtime(): number {
        try {
            return fs.statSync(this.config.sentinelPath).mtimeMs;
        } catch {
            return 0;
        }
    }
}
