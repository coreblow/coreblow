/**
 * src/gateway/queue.ts
 * Message queue — buffer, priority, concurrency, dead letter
 * SUPERIOR: CoreBlow processes messages synchronously; CoreBlow has async queue with backpressure
 */

import { createChildLogger } from '../utils/logger.js';
import type { InboundMessage } from './router.js';

const log = createChildLogger('queue');

// ─── Types ────────────────────────────────────────────────────────

export type QueuePriority = 'high' | 'normal' | 'low';

export interface QueueItem {
    id: string;
    message: InboundMessage;
    priority: QueuePriority;
    enqueuedAt: number;
    attempts: number;
    maxAttempts: number;
    /** Scheduled processing time (for delayed messages) */
    processAfter?: number;
    /** Metadata */
    metadata?: Record<string, unknown>;
}

export interface QueueConfig {
    /** Max items in queue before backpressure */
    maxSize: number;
    /** Max concurrent processors */
    concurrency: number;
    /** Default max retry attempts */
    maxAttempts: number;
    /** Process interval in ms */
    processIntervalMs: number;
    /** Dead letter queue max size */
    deadLetterMaxSize: number;
}

export type QueueProcessor = (item: QueueItem) => Promise<void>;

export interface QueueStats {
    size: number;
    processing: number;
    processed: number;
    failed: number;
    deadLetterSize: number;
    avgProcessTimeMs: number;
    oldestItemAge: number;
}

// ─── Message Queue ───────────────────────────────────────────────

export class MessageQueue {
    private queues: { high: QueueItem[]; normal: QueueItem[]; low: QueueItem[] } = {
        high: [], normal: [], low: [],
    };
    private deadLetter: QueueItem[] = [];
    private processing = new Set<string>();
    private processor?: QueueProcessor;
    private timer?: ReturnType<typeof setInterval>;
    private config: QueueConfig;
    private stats = { processed: 0, failed: 0, totalProcessTimeMs: 0 };
    private counter = 0;
    private paused = false;

    constructor(config?: Partial<QueueConfig>) {
        this.config = {
            maxSize: config?.maxSize ?? 1000,
            concurrency: config?.concurrency ?? 5,
            maxAttempts: config?.maxAttempts ?? 3,
            processIntervalMs: config?.processIntervalMs ?? 100,
            deadLetterMaxSize: config?.deadLetterMaxSize ?? 100,
        };
    }

    /**
     * Set the message processor
     */
    setProcessor(processor: QueueProcessor): void {
        this.processor = processor;
    }

    /**
     * Enqueue a message
     */
    enqueue(message: InboundMessage, priority: QueuePriority = 'normal', metadata?: Record<string, unknown>): QueueItem | null {
        const totalSize = this.size();
        if (totalSize >= this.config.maxSize) {
            log.warn({ size: totalSize, max: this.config.maxSize }, 'Queue full — backpressure');
            return null;
        }

        const item: QueueItem = {
            id: `q_${++this.counter}_${Date.now()}`,
            message,
            priority,
            enqueuedAt: Date.now(),
            attempts: 0,
            maxAttempts: this.config.maxAttempts,
            metadata,
        };

        this.queues[priority].push(item);
        log.debug({ id: item.id, priority, queueSize: totalSize + 1 }, 'Message enqueued');
        return item;
    }

    /**
     * Enqueue with delay
     */
    enqueueDelayed(message: InboundMessage, delayMs: number, priority: QueuePriority = 'normal'): QueueItem | null {
        const item = this.enqueue(message, priority);
        if (item) {
            item.processAfter = Date.now() + delayMs;
        }
        return item;
    }

    /**
     * Start processing the queue
     */
    start(): void {
        if (this.timer) return;
        this.paused = false;
        this.timer = setInterval(() => this.tick(), this.config.processIntervalMs);
        log.info({ concurrency: this.config.concurrency }, 'Queue processing started');
    }

    /**
     * Stop processing
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        log.info('Queue processing stopped');
    }

    /**
     * Pause processing (keeps items in queue)
     */
    pause(): void {
        this.paused = true;
    }

    /**
     * Resume processing
     */
    resume(): void {
        this.paused = false;
    }

    /**
     * Process one tick — dequeue and process items up to concurrency limit
     */
    private async tick(): Promise<void> {
        if (this.paused || !this.processor) return;

        const available = this.config.concurrency - this.processing.size;
        if (available <= 0) return;

        const now = Date.now();

        for (let i = 0; i < available; i++) {
            const item = this.dequeue(now);
            if (!item) break;

            this.processing.add(item.id);
            this.processItem(item).catch(() => { }); // errors handled inside
        }
    }

    /**
     * Dequeue highest priority item that's ready
     */
    private dequeue(now: number): QueueItem | undefined {
        // Priority order: high → normal → low
        for (const priority of ['high', 'normal', 'low'] as QueuePriority[]) {
            const queue = this.queues[priority];
            const idx = queue.findIndex(item =>
                !item.processAfter || item.processAfter <= now
            );
            if (idx >= 0) {
                return queue.splice(idx, 1)[0];
            }
        }
        return undefined;
    }

    /**
     * Process a single item
     */
    private async processItem(item: QueueItem): Promise<void> {
        item.attempts++;
        const start = Date.now();

        try {
            await this.processor!(item);
            this.stats.processed++;
            this.stats.totalProcessTimeMs += Date.now() - start;
        } catch (err: unknown) {
            log.error({ id: item.id, attempt: item.attempts, err: (err instanceof Error ? err.message : String(err)) }, 'Processing failed');

            if (item.attempts < item.maxAttempts) {
                // Re-enqueue with exponential backoff delay
                item.processAfter = Date.now() + Math.pow(2, item.attempts) * 1000;
                this.queues[item.priority].push(item);
                log.debug({ id: item.id, retryIn: item.processAfter - Date.now() }, 'Requeueing');
            } else {
                // Move to dead letter queue
                this.deadLetter.push(item);
                if (this.deadLetter.length > this.config.deadLetterMaxSize) {
                    this.deadLetter.shift();
                }
                this.stats.failed++;
                log.warn({ id: item.id, attempts: item.attempts }, 'Message moved to dead letter');
            }
        } finally {
            this.processing.delete(item.id);
        }
    }

    /**
     * Process all items immediately (for testing / shutdown)
     */
    async flush(): Promise<void> {
        if (!this.processor) return;
        const now = Date.now();
        let item: QueueItem | undefined;
        while ((item = this.dequeue(now))) {
            await this.processItem(item);
        }
    }

    /**
     * Get total queue size
     */
    size(): number {
        return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
    }

    /**
     * Get dead letter queue
     */
    getDeadLetters(): QueueItem[] {
        return [...this.deadLetter];
    }

    /**
     * Retry a dead letter item
     */
    retryDeadLetter(itemId: string): boolean {
        const idx = this.deadLetter.findIndex(i => i.id === itemId);
        if (idx < 0) return false;

        const item = this.deadLetter.splice(idx, 1)[0];
        item.attempts = 0;
        item.processAfter = undefined;
        this.queues[item.priority].push(item);
        return true;
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queues = { high: [], normal: [], low: [] };
        this.deadLetter = [];
    }

    /**
     * Get stats
     */
    getStats(): QueueStats {
        const now = Date.now();
        const allItems = [...this.queues.high, ...this.queues.normal, ...this.queues.low];
        const oldest = allItems.length > 0
            ? now - Math.min(...allItems.map(i => i.enqueuedAt))
            : 0;

        return {
            size: this.size(),
            processing: this.processing.size,
            processed: this.stats.processed,
            failed: this.stats.failed,
            deadLetterSize: this.deadLetter.length,
            avgProcessTimeMs: this.stats.processed > 0
                ? Math.round(this.stats.totalProcessTimeMs / this.stats.processed)
                : 0,
            oldestItemAge: oldest,
        };
    }
}
