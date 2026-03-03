/**
 * CoreBlow — Graceful Shutdown
 *
 * Manages clean shutdown of all subsystems with
 * configurable timeout, hook ordering, and forced
 * exit fallback.
 */

/** Shutdown hook */
export interface ShutdownHook {
    name: string;
    order: number;
    handler: () => Promise<void>;
    timeoutMs?: number;
}

/** Shutdown result */
export interface ShutdownResult {
    completed: string[];
    timedOut: string[];
    failed: Array<{ name: string; error: string }>;
    totalDurationMs: number;
}

/**
 * CoreBlow Graceful Shutdown
 */
export class GracefulShutdown {
    private hooks: ShutdownHook[] = [];
    private isShuttingDown = false;
    private defaultTimeoutMs = 10_000;
    private lastResult: ShutdownResult | null = null;

    /**
     * Register a shutdown hook.
     */
    register(hook: ShutdownHook): void {
        this.hooks.push(hook);
        this.hooks.sort((a, b) => a.order - b.order);
    }

    /**
     * Execute graceful shutdown.
     */
    async shutdown(): Promise<ShutdownResult> {
        if (this.isShuttingDown) return this.lastResult ?? { completed: [], timedOut: [], failed: [], totalDurationMs: 0 };
        this.isShuttingDown = true;
        const start = Date.now();
        const completed: string[] = [];
        const timedOut: string[] = [];
        const failed: ShutdownResult['failed'] = [];

        for (const hook of this.hooks) {
            const timeout = hook.timeoutMs ?? this.defaultTimeoutMs;
            try {
                await Promise.race([
                    hook.handler(),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
                ]);
                completed.push(hook.name);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg === 'timeout') timedOut.push(hook.name);
                else failed.push({ name: hook.name, error: msg });
            }
        }

        this.lastResult = { completed, timedOut, failed, totalDurationMs: Date.now() - start };
        this.isShuttingDown = false;
        return this.lastResult;
    }

    /**
     * Check if shutting down.
     */
    isInProgress(): boolean { return this.isShuttingDown; }

    /**
     * Get last result.
     */
    getLastResult(): ShutdownResult | null { return this.lastResult; }

    /**
     * List hooks.
     */
    list(): Array<{ name: string; order: number }> {
        return this.hooks.map((h) => ({ name: h.name, order: h.order }));
    }

    /** Count */
    count(): number { return this.hooks.length; }
}
