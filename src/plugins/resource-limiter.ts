/**
 * plugins/resource-limiter.ts
 *
 * Plugin resource limits — enforces CPU time, memory, I/O, and
 * concurrent operation budgets for sandboxed plugin execution.
 *
 * Following CoreBlow's Docker sandbox resource pattern (types.sandbox.ts)
 * adapted for CoreBlow's non-Docker, process-level enforcement.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:resource-limiter');

// ─── Types ───────────────────────────────────────────────────────

/** Resource limit configuration per plugin */
export interface ResourceLimits {
    /** Max heap memory in MB (0 = unlimited) */
    maxMemoryMB: number;
    /** Max CPU time per operation in ms (0 = unlimited) */
    maxCpuTimeMs: number;
    /** Max concurrent async operations */
    maxConcurrentOps: number;
    /** Max total operations per minute */
    maxOpsPerMinute: number;
    /** Max file size for write operations in bytes */
    maxFileSizeBytes: number;
    /** Max network requests per minute */
    maxNetworkReqPerMinute: number;
    /** Max store entries (KV store size limit) */
    maxStoreEntries: number;
}

/** Resource usage snapshot */
export interface ResourceUsage {
    pluginId: string;
    currentOps: number;
    opsThisMinute: number;
    networkReqThisMinute: number;
    storeEntries: number;
    violations: ResourceViolation[];
    lastReset: number;
}

/** A recorded violation */
export interface ResourceViolation {
    pluginId: string;
    resource: keyof ResourceLimits;
    limit: number;
    actual: number;
    timestamp: number;
    action: string;
}

/** Predefined limit profiles */
export type LimitProfile = 'strict' | 'standard' | 'permissive' | 'unlimited';

// ─── Preset Profiles ─────────────────────────────────────────────

const LIMIT_PROFILES: Record<LimitProfile, ResourceLimits> = {
    strict: {
        maxMemoryMB: 64,
        maxCpuTimeMs: 5000,
        maxConcurrentOps: 3,
        maxOpsPerMinute: 30,
        maxFileSizeBytes: 1024 * 1024,      // 1 MB
        maxNetworkReqPerMinute: 10,
        maxStoreEntries: 100,
    },
    standard: {
        maxMemoryMB: 256,
        maxCpuTimeMs: 30000,
        maxConcurrentOps: 10,
        maxOpsPerMinute: 120,
        maxFileSizeBytes: 10 * 1024 * 1024,  // 10 MB
        maxNetworkReqPerMinute: 60,
        maxStoreEntries: 1000,
    },
    permissive: {
        maxMemoryMB: 512,
        maxCpuTimeMs: 60000,
        maxConcurrentOps: 50,
        maxOpsPerMinute: 600,
        maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
        maxNetworkReqPerMinute: 300,
        maxStoreEntries: 10000,
    },
    unlimited: {
        maxMemoryMB: 0,
        maxCpuTimeMs: 0,
        maxConcurrentOps: 0,
        maxOpsPerMinute: 0,
        maxFileSizeBytes: 0,
        maxNetworkReqPerMinute: 0,
        maxStoreEntries: 0,
    },
};

/** Get a preset limit profile */
export function getLimitProfile(profile: LimitProfile): ResourceLimits {
    return { ...LIMIT_PROFILES[profile] };
}

// ─── ResourceLimiter ─────────────────────────────────────────────

/**
 * CoreBlow Resource Limiter
 *
 * Tracks and enforces per-plugin resource budgets. Each plugin gets its
 * own limiter instance with operation counters, rate limiting, and
 * violation recording.
 */
export class ResourceLimiter {
    private pluginId: string;
    private limits: ResourceLimits;
    private currentOps = 0;
    private opsThisMinute = 0;
    private networkReqThisMinute = 0;
    private storeEntries = 0;
    private violations: ResourceViolation[] = [];
    private lastMinuteReset: number;
    private minuteTimer: ReturnType<typeof setInterval> | null = null;

    constructor(pluginId: string, limits?: Partial<ResourceLimits> | LimitProfile) {
        this.pluginId = pluginId;
        this.lastMinuteReset = Date.now();

        if (typeof limits === 'string') {
            this.limits = getLimitProfile(limits);
        } else {
            this.limits = { ...LIMIT_PROFILES.standard, ...limits };
        }
    }

    // ─── Guards ──────────────────────────────────────────────────

    /**
     * Check and consume a concurrent operation slot.
     * Returns true if allowed, false if limit exceeded.
     */
    acquireOp(action: string): boolean {
        this.maybeResetMinute();

        if (this.limits.maxConcurrentOps > 0 && this.currentOps >= this.limits.maxConcurrentOps) {
            this.recordViolation('maxConcurrentOps', this.currentOps, action);
            return false;
        }
        if (this.limits.maxOpsPerMinute > 0 && this.opsThisMinute >= this.limits.maxOpsPerMinute) {
            this.recordViolation('maxOpsPerMinute', this.opsThisMinute, action);
            return false;
        }

        this.currentOps++;
        this.opsThisMinute++;
        return true;
    }

    /**
     * Release a concurrent operation slot.
     */
    releaseOp(): void {
        if (this.currentOps > 0) this.currentOps--;
    }

    /**
     * Check if a network request is allowed.
     */
    checkNetwork(action: string): boolean {
        this.maybeResetMinute();

        if (this.limits.maxNetworkReqPerMinute > 0 && this.networkReqThisMinute >= this.limits.maxNetworkReqPerMinute) {
            this.recordViolation('maxNetworkReqPerMinute', this.networkReqThisMinute, action);
            return false;
        }

        this.networkReqThisMinute++;
        return true;
    }

    /**
     * Check if a file write is within size limits.
     */
    checkFileSize(sizeBytes: number, action: string): boolean {
        if (this.limits.maxFileSizeBytes > 0 && sizeBytes > this.limits.maxFileSizeBytes) {
            this.recordViolation('maxFileSizeBytes', sizeBytes, action);
            return false;
        }
        return true;
    }

    /**
     * Check if a store entry can be added.
     */
    checkStoreEntry(currentCount: number, action: string): boolean {
        if (this.limits.maxStoreEntries > 0 && currentCount >= this.limits.maxStoreEntries) {
            this.recordViolation('maxStoreEntries', currentCount, action);
            return false;
        }
        this.storeEntries = currentCount;
        return true;
    }

    /**
     * Wrap an async operation with CPU time limit.
     */
    async withTimeout<T>(fn: () => Promise<T>, action: string): Promise<T> {
        if (this.limits.maxCpuTimeMs <= 0) {
            return fn();
        }

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.recordViolation('maxCpuTimeMs', this.limits.maxCpuTimeMs, action);
                reject(new Error(`Plugin "${this.pluginId}" operation timed out after ${this.limits.maxCpuTimeMs}ms: ${action}`));
            }, this.limits.maxCpuTimeMs);

            fn()
                .then((result) => { clearTimeout(timer); resolve(result); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }

    // ─── Usage / Info ────────────────────────────────────────────

    getUsage(): ResourceUsage {
        this.maybeResetMinute();
        return {
            pluginId: this.pluginId,
            currentOps: this.currentOps,
            opsThisMinute: this.opsThisMinute,
            networkReqThisMinute: this.networkReqThisMinute,
            storeEntries: this.storeEntries,
            violations: [...this.violations],
            lastReset: this.lastMinuteReset,
        };
    }

    getLimits(): ResourceLimits {
        return { ...this.limits };
    }

    getViolations(): ResourceViolation[] {
        return [...this.violations];
    }

    getViolationCount(): number {
        return this.violations.length;
    }

    /**
     * Check if the plugin has exceeded any limits recently.
     */
    hasViolations(): boolean {
        return this.violations.length > 0;
    }

    /**
     * Reset all counters (e.g., on plugin reload).
     */
    reset(): void {
        this.currentOps = 0;
        this.opsThisMinute = 0;
        this.networkReqThisMinute = 0;
        this.storeEntries = 0;
        this.violations = [];
        this.lastMinuteReset = Date.now();
    }

    /**
     * Stop this limiter (clean up timer).
     */
    dispose(): void {
        if (this.minuteTimer) {
            clearInterval(this.minuteTimer);
            this.minuteTimer = null;
        }
    }

    // ─── Private ─────────────────────────────────────────────────

    private maybeResetMinute(): void {
        const now = Date.now();
        if (now - this.lastMinuteReset >= 60_000) {
            this.opsThisMinute = 0;
            this.networkReqThisMinute = 0;
            this.lastMinuteReset = now;
        }
    }

    private recordViolation(resource: keyof ResourceLimits, actual: number, action: string): void {
        const violation: ResourceViolation = {
            pluginId: this.pluginId,
            resource,
            limit: this.limits[resource],
            actual,
            timestamp: Date.now(),
            action,
        };
        this.violations.push(violation);
        if (this.violations.length > 100) {
            this.violations = this.violations.slice(-100);
        }
        log.warn({ ...violation }, `Resource limit exceeded: ${resource}`);
    }
}

export interface ResourceProfile { maxMemoryMb?: number; maxCpuPercent?: number; maxConcurrentOps?: number; maxOpsPerMinute?: number; maxNetworkReqPerMinute?: number; }
