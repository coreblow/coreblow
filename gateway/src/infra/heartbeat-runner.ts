/**
 * infra/heartbeat-runner.ts
 * Background heartbeat for health monitoring.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('heartbeat');

export interface HeartbeatCheck {
    name: string;
    check: () => Promise<{ healthy: boolean; detail?: string }>;
}

export class HeartbeatRunner {
    private checks: HeartbeatCheck[] = [];
    private interval: NodeJS.Timeout | null = null;
    private lastResults = new Map<string, { healthy: boolean; detail?: string; checkedAt: number }>();
    private running = false;

    register(check: HeartbeatCheck): void { this.checks.push(check); }

    start(intervalMs = 30000): void {
        if (this.running) return;
        this.running = true;
        log.info({ interval: intervalMs, checks: this.checks.length }, 'Heartbeat started');
        this.runChecks();
        this.interval = setInterval(() => this.runChecks(), intervalMs);
    }

    stop(): void {
        this.running = false;
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        log.info('Heartbeat stopped');
    }

    private async runChecks(): Promise<void> {
        for (const check of this.checks) {
            try {
                const result = await check.check();
                this.lastResults.set(check.name, { ...result, checkedAt: Date.now() });
                if (!result.healthy) log.warn({ check: check.name, detail: result.detail }, 'Unhealthy');
            } catch (err) {
                this.lastResults.set(check.name, { healthy: false, detail: String(err), checkedAt: Date.now() });
            }
        }
    }

    getStatus(): Record<string, { healthy: boolean; detail?: string; checkedAt: number }> {
        return Object.fromEntries(this.lastResults);
    }

    get isHealthy(): boolean {
        return Array.from(this.lastResults.values()).every(r => r.healthy);
    }
}
