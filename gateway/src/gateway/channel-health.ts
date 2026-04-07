/**
 * CoreBlow Channel Health Monitor
 *
 * Monitors channel health with heartbeat tracking, automatic recovery,
 * and status reporting per-channel.
 *
 * Equivalent: CoreBlow gateway/channel-health-monitor.ts + channel-health-policy.ts (~351 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

const log = createChildLogger('gateway:channel-health');

export type ChannelHealthStatus = 'connected' | 'degraded' | 'disconnected' | 'unknown';

export interface ChannelHealthState {
    channelId: string;
    status: ChannelHealthStatus;
    lastHeartbeat: number;
    lastError?: string;
    errorCount: number;
    successCount: number;
    latencyMs?: number;
    connectedSince?: number;
    metadata?: Record<string, unknown>;
}

export interface HealthPolicy {
    heartbeatIntervalMs: number;
    heartbeatTimeoutMs: number;
    maxConsecutiveErrors: number;
    autoRecover: boolean;
    recoveryDelayMs: number;
}

const DEFAULT_POLICY: HealthPolicy = {
    heartbeatIntervalMs: 30_000,
    heartbeatTimeoutMs: 10_000,
    maxConsecutiveErrors: 3,
    autoRecover: true,
    recoveryDelayMs: 5_000,
};

export class ChannelHealthMonitor extends EventEmitter {
    private channels = new Map<string, ChannelHealthState>();
    private timers = new Map<string, ReturnType<typeof setInterval>>();
    private policy: HealthPolicy;

    constructor(policy?: Partial<HealthPolicy>) {
        super();
        this.policy = { ...DEFAULT_POLICY, ...policy };
    }

    register(channelId: string, metadata?: Record<string, unknown>): void {
        this.channels.set(channelId, {
            channelId,
            status: 'unknown',
            lastHeartbeat: 0,
            errorCount: 0,
            successCount: 0,
            metadata,
        });
    }

    recordHeartbeat(channelId: string, latencyMs?: number): void {
        const state = this.channels.get(channelId);
        if (!state) return;
        state.lastHeartbeat = Date.now();
        state.latencyMs = latencyMs;
        state.successCount++;
        if (state.status !== 'connected') {
            state.status = 'connected';
            state.connectedSince = Date.now();
            state.errorCount = 0;
            this.emit('recovered', { channelId });
        }
    }

    recordError(channelId: string, error: string): void {
        const state = this.channels.get(channelId);
        if (!state) return;
        state.errorCount++;
        state.lastError = error;

        if (state.errorCount >= this.policy.maxConsecutiveErrors) {
            state.status = 'disconnected';
            this.emit('disconnected', { channelId, error, errorCount: state.errorCount });
        } else {
            state.status = 'degraded';
            this.emit('degraded', { channelId, error, errorCount: state.errorCount });
        }
    }

    getStatus(channelId: string): ChannelHealthState | undefined {
        return this.channels.get(channelId);
    }

    getAllStatuses(): ChannelHealthState[] {
        return Array.from(this.channels.values());
    }

    getHealthySummary(): { total: number; healthy: number; degraded: number; disconnected: number } {
        let healthy = 0, degraded = 0, disconnected = 0;
        for (const state of this.channels.values()) {
            if (state.status === 'connected') healthy++;
            else if (state.status === 'degraded') degraded++;
            else disconnected++;
        }
        return { total: this.channels.size, healthy, degraded, disconnected };
    }

    startMonitoring(channelId: string, heartbeatFn: () => Promise<void>): void {
        this.stopMonitoring(channelId);
        const timer = setInterval(async () => {
            try {
                const start = Date.now();
                await heartbeatFn();
                this.recordHeartbeat(channelId, Date.now() - start);
            } catch (err) {
                this.recordError(channelId, err instanceof Error ? err.message : String(err));
            }
        }, this.policy.heartbeatIntervalMs);
        if (typeof timer === 'object' && 'unref' in timer) (timer as NodeJS.Timeout).unref();
        this.timers.set(channelId, timer);
    }

    stopMonitoring(channelId: string): void {
        const timer = this.timers.get(channelId);
        if (timer) { clearInterval(timer); this.timers.delete(channelId); }
    }

    stopAll(): void {
        for (const timer of this.timers.values()) clearInterval(timer);
        this.timers.clear();
    }

    remove(channelId: string): void {
        this.stopMonitoring(channelId);
        this.channels.delete(channelId);
    }

    clear(): void {
        this.stopAll();
        this.channels.clear();
    }
}
