/**
 * CoreBlow Session Write Lock
 *
 * Implements a session-level write lock to prevent concurrent mutations
 * on the same session. Ensures transcript integrity during multi-turn
 * conversations and tool execution.
 *
 * Equivalent: CoreBlow src/agents/session-write-lock.ts (591 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('session-write-lock');

// ─── Types ────────────────────────────────────────────────────────

export interface LockState {
    sessionId: string;
    holder: string;
    acquiredAt: number;
    expiresAt: number;
    depth: number;
    metadata?: Record<string, unknown>;
}

export interface LockOptions {
    /** Who is acquiring the lock */
    holder: string;
    /** Lock timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Whether to allow re-entrant locking by the same holder */
    reentrant?: boolean;
    /** Maximum wait time for acquiring the lock */
    waitMs?: number;
    /** Metadata to attach to the lock */
    metadata?: Record<string, unknown>;
}

export interface LockResult {
    acquired: boolean;
    lock?: LockState;
    error?: string;
    waitedMs?: number;
}

export interface LockStats {
    activeLocks: number;
    totalAcquired: number;
    totalReleased: number;
    totalTimedOut: number;
    totalContended: number;
    averageHoldTimeMs: number;
}

// ─── Session Write Lock Manager ───────────────────────────────────

export class SessionWriteLockManager {
    private locks = new Map<string, LockState>();
    private waitQueues = new Map<string, Array<{
        resolve: (result: LockResult) => void;
        options: LockOptions;
        enqueuedAt: number;
    }>>();
    private stats = {
        totalAcquired: 0,
        totalReleased: 0,
        totalTimedOut: 0,
        totalContended: 0,
        holdTimes: [] as number[],
    };
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor(private cleanupIntervalMs: number = 5000) {
        this.startCleanup();
    }

    /**
     * Acquire a write lock for a session
     */
    async acquire(sessionId: string, options: LockOptions): Promise<LockResult> {
        const timeoutMs = options.timeoutMs ?? 30_000;
        const existing = this.locks.get(sessionId);

        // Check if lock exists and is still valid
        if (existing) {
            // Check expiry
            if (existing.expiresAt <= Date.now()) {
                log.warn({ sessionId, holder: existing.holder }, 'Lock expired, releasing');
                this.forceRelease(sessionId);
            } else if (options.reentrant && existing.holder === options.holder) {
                // Re-entrant: increment depth
                existing.depth += 1;
                log.debug({ sessionId, holder: options.holder, depth: existing.depth }, 'Lock re-entered');
                return { acquired: true, lock: { ...existing } };
            } else {
                // Lock is held by someone else
                this.stats.totalContended++;

                if (!options.waitMs || options.waitMs <= 0) {
                    return {
                        acquired: false,
                        error: `Session "${sessionId}" is locked by "${existing.holder}"`,
                    };
                }

                // Wait for lock
                return this.waitForLock(sessionId, options);
            }
        }

        // Acquire the lock
        const lock: LockState = {
            sessionId,
            holder: options.holder,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + timeoutMs,
            depth: 1,
            metadata: options.metadata,
        };

        this.locks.set(sessionId, lock);
        this.stats.totalAcquired++;
        log.debug({ sessionId, holder: options.holder, timeoutMs }, 'Lock acquired');

        return { acquired: true, lock: { ...lock } };
    }

    /**
     * Release a write lock
     */
    release(sessionId: string, holder: string): boolean {
        const existing = this.locks.get(sessionId);
        if (!existing) {
            log.debug({ sessionId, holder }, 'Lock release: no lock found');
            return false;
        }

        if (existing.holder !== holder) {
            log.warn({ sessionId, holder, lockHolder: existing.holder }, 'Lock release: holder mismatch');
            return false;
        }

        // Handle re-entrant locks
        if (existing.depth > 1) {
            existing.depth -= 1;
            log.debug({ sessionId, holder, depth: existing.depth }, 'Lock depth decremented');
            return true;
        }

        // Fully release
        const holdTime = Date.now() - existing.acquiredAt;
        this.locks.delete(sessionId);
        this.stats.totalReleased++;
        this.stats.holdTimes.push(holdTime);
        // Keep only last 1000 hold times for average calculation
        if (this.stats.holdTimes.length > 1000) {
            this.stats.holdTimes = this.stats.holdTimes.slice(-1000);
        }

        log.debug({ sessionId, holder, holdTimeMs: holdTime }, 'Lock released');

        // Process wait queue
        this.processWaitQueue(sessionId);

        return true;
    }

    /**
     * Force-release a lock (for cleanup/admin)
     */
    forceRelease(sessionId: string): boolean {
        const existing = this.locks.get(sessionId);
        if (!existing) return false;

        this.locks.delete(sessionId);
        this.stats.totalTimedOut++;
        log.warn({ sessionId, holder: existing.holder }, 'Lock force-released');

        this.processWaitQueue(sessionId);
        return true;
    }

    /**
     * Check if a session is locked
     */
    isLocked(sessionId: string): boolean {
        const lock = this.locks.get(sessionId);
        if (!lock) return false;
        if (lock.expiresAt <= Date.now()) {
            this.forceRelease(sessionId);
            return false;
        }
        return true;
    }

    /**
     * Get lock info for a session
     */
    getLockInfo(sessionId: string): LockState | null {
        const lock = this.locks.get(sessionId);
        if (!lock) return null;
        if (lock.expiresAt <= Date.now()) {
            this.forceRelease(sessionId);
            return null;
        }
        return { ...lock };
    }

    /**
     * Execute a function while holding the lock
     */
    async withLock<T>(
        sessionId: string,
        options: LockOptions,
        fn: () => Promise<T>,
    ): Promise<{ result?: T; error?: string }> {
        const lockResult = await this.acquire(sessionId, options);
        if (!lockResult.acquired) {
            return { error: lockResult.error ?? 'Failed to acquire lock' };
        }

        try {
            const result = await fn();
            return { result };
        } finally {
            this.release(sessionId, options.holder);
        }
    }

    /**
     * Get lock statistics
     */
    getStats(): LockStats {
        const holdTimes = this.stats.holdTimes;
        const averageHoldTimeMs = holdTimes.length > 0
            ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
            : 0;

        return {
            activeLocks: this.locks.size,
            totalAcquired: this.stats.totalAcquired,
            totalReleased: this.stats.totalReleased,
            totalTimedOut: this.stats.totalTimedOut,
            totalContended: this.stats.totalContended,
            averageHoldTimeMs: Math.round(averageHoldTimeMs),
        };
    }

    /**
     * List all active locks
     */
    listActiveLocks(): LockState[] {
        const now = Date.now();
        const active: LockState[] = [];
        for (const [sessionId, lock] of this.locks) {
            if (lock.expiresAt <= now) {
                this.forceRelease(sessionId);
            } else {
                active.push({ ...lock });
            }
        }
        return active;
    }

    /**
     * Extend a lock's expiry
     */
    extend(sessionId: string, holder: string, additionalMs: number): boolean {
        const lock = this.locks.get(sessionId);
        if (!lock || lock.holder !== holder) return false;

        lock.expiresAt += additionalMs;
        log.debug({ sessionId, holder, newExpiresAt: lock.expiresAt }, 'Lock extended');
        return true;
    }

    /**
     * Shutdown the lock manager
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        // Release all locks
        for (const sessionId of [...this.locks.keys()]) {
            this.forceRelease(sessionId);
        }
        // Reject all waiters
        for (const [, queue] of this.waitQueues) {
            for (const waiter of queue) {
                waiter.resolve({ acquired: false, error: 'Lock manager shutting down' });
            }
        }
        this.waitQueues.clear();
    }

    // ─── Private ──────────────────────────────────────────────────

    private async waitForLock(sessionId: string, options: LockOptions): Promise<LockResult> {
        const waitMs = options.waitMs ?? 5000;
        const enqueuedAt = Date.now();

        return new Promise<LockResult>((resolve) => {
            const queue = this.waitQueues.get(sessionId) ?? [];
            queue.push({ resolve, options, enqueuedAt });
            this.waitQueues.set(sessionId, queue);

            // Set timeout
            setTimeout(() => {
                const q = this.waitQueues.get(sessionId) ?? [];
                const idx = q.findIndex((w) => w.resolve === resolve);
                if (idx !== -1) {
                    q.splice(idx, 1);
                    resolve({
                        acquired: false,
                        error: `Timed out waiting for lock on session "${sessionId}"`,
                        waitedMs: Date.now() - enqueuedAt,
                    });
                }
            }, waitMs);
        });
    }

    private processWaitQueue(sessionId: string): void {
        const queue = this.waitQueues.get(sessionId);
        if (!queue || queue.length === 0) return;

        const next = queue.shift()!;
        if (queue.length === 0) {
            this.waitQueues.delete(sessionId);
        }

        // Try to acquire for the next waiter
        const timeoutMs = next.options.timeoutMs ?? 30_000;
        const lock: LockState = {
            sessionId,
            holder: next.options.holder,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + timeoutMs,
            depth: 1,
            metadata: next.options.metadata,
        };

        this.locks.set(sessionId, lock);
        this.stats.totalAcquired++;

        next.resolve({
            acquired: true,
            lock: { ...lock },
            waitedMs: Date.now() - next.enqueuedAt,
        });
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, lock] of this.locks) {
                if (lock.expiresAt <= now) {
                    this.forceRelease(sessionId);
                }
            }
        }, this.cleanupIntervalMs);

        // Don't block Node.js from exiting
        if (this.cleanupInterval && typeof this.cleanupInterval === 'object' && 'unref' in this.cleanupInterval) {
            this.cleanupInterval.unref();
        }
    }
}

// ─── Default Instance ─────────────────────────────────────────────

let defaultManager: SessionWriteLockManager | null = null;

export function getSessionWriteLockManager(): SessionWriteLockManager {
    if (!defaultManager) {
        defaultManager = new SessionWriteLockManager();
    }
    return defaultManager;
}

export function resetSessionWriteLockManager(): void {
    defaultManager?.shutdown();
    defaultManager = null;
}
