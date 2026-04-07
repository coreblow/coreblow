/**
 * CoreBlow Concurrency Limiter (Expanded)
 *
 * Advanced concurrency control with named semaphores, priority queues,
 * timeout support, and per-key limiting.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('gateway:concurrency');

interface QueueEntry {
    resolve: () => void;
    reject: (err: Error) => void;
    priority: number;
    enqueuedAt: number;
    timeoutId?: ReturnType<typeof setTimeout>;
}

export class ConcurrencyLimiter {
    private active = 0;
    private queue: QueueEntry[] = [];
    private totalAcquired = 0;
    private totalRejected = 0;

    constructor(
        private max: number = 10,
        private defaultTimeoutMs: number = 30_000,
    ) {}

    async acquire(priority: number = 0, timeoutMs?: number): Promise<void> {
        if (this.active < this.max) {
            this.active++;
            this.totalAcquired++;
            return;
        }

        const timeout = timeoutMs ?? this.defaultTimeoutMs;
        return new Promise<void>((resolve, reject) => {
            const entry: QueueEntry = {
                resolve: () => { this.active++; this.totalAcquired++; resolve(); },
                reject,
                priority,
                enqueuedAt: Date.now(),
            };

            if (timeout > 0) {
                entry.timeoutId = setTimeout(() => {
                    const idx = this.queue.indexOf(entry);
                    if (idx >= 0) {
                        this.queue.splice(idx, 1);
                        this.totalRejected++;
                        reject(new Error('Concurrency acquire timeout'));
                    }
                }, timeout);
            }

            // Insert sorted by priority (higher first)
            const insertIdx = this.queue.findIndex((e) => e.priority < priority);
            if (insertIdx >= 0) this.queue.splice(insertIdx, 0, entry);
            else this.queue.push(entry);
        });
    }

    release(): void {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) {
            if (next.timeoutId) clearTimeout(next.timeoutId);
            next.resolve();
        }
    }

    async withLimit<T>(fn: () => Promise<T>, priority?: number): Promise<T> {
        await this.acquire(priority);
        try { return await fn(); }
        finally { this.release(); }
    }

    getActive(): number { return this.active; }
    getQueued(): number { return this.queue.length; }
    getMax(): number { return this.max; }
    setMax(max: number): void { this.max = max; this.drainQueue(); }
    getStats() {
        return { active: this.active, queued: this.queue.length, max: this.max, totalAcquired: this.totalAcquired, totalRejected: this.totalRejected };
    }

    private drainQueue(): void {
        while (this.active < this.max && this.queue.length > 0) {
            const next = this.queue.shift()!;
            if (next.timeoutId) clearTimeout(next.timeoutId);
            next.resolve();
        }
    }
}

// ─── Per-Key Limiter ──────────────────────────────────────────────

const keyLimiters = new Map<string, ConcurrencyLimiter>();

export function getKeyLimiter(key: string, max: number = 5): ConcurrencyLimiter {
    let limiter = keyLimiters.get(key);
    if (!limiter) {
        limiter = new ConcurrencyLimiter(max);
        keyLimiters.set(key, limiter);
    }
    return limiter;
}

export function clearKeyLimiters(): void { keyLimiters.clear(); }
