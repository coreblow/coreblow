/**
 * auto-reply/reply/queue.ts
 * Reply queue — prevent duplicate replies, rate limiting.
 */

import { createChildLogger } from '../../utils/logger.js';
import type { ReplyEnvelope } from '../types.js';

const log = createChildLogger('reply-queue');

interface QueuedReply {
    envelope: ReplyEnvelope;
    addedAt: number;
    attempts: number;
}

export class ReplyQueue {
    private queue: QueuedReply[] = [];
    private processing = new Set<string>();
    private recentReplies = new Map<string, number>(); // messageId -> timestamp
    private maxSize: number;
    private rateLimitPerMinute: number;

    constructor(maxSize = 100, rateLimitPerMinute = 20) {
        this.maxSize = maxSize;
        this.rateLimitPerMinute = rateLimitPerMinute;
    }

    /** Add a reply to the queue. Returns false if rejected. */
    enqueue(envelope: ReplyEnvelope): boolean {
        // Duplicate check
        if (this.recentReplies.has(envelope.inbound.id)) {
            log.debug({ messageId: envelope.inbound.id }, 'Duplicate message, skipping');
            return false;
        }

        // Queue size limit
        if (this.queue.length >= this.maxSize) {
            log.warn({ queueSize: this.queue.length }, 'Reply queue full');
            return false;
        }

        // Rate limit check
        if (this.isRateLimited(envelope.inbound.channel)) {
            log.info({ channel: envelope.inbound.channel }, 'Rate limited');
            return false;
        }

        this.queue.push({ envelope, addedAt: Date.now(), attempts: 0 });
        this.queue.sort((a, b) => b.envelope.priority - a.envelope.priority);
        this.recentReplies.set(envelope.inbound.id, Date.now());

        return true;
    }

    /** Get the next reply from the queue. */
    dequeue(): ReplyEnvelope | null {
        const item = this.queue.shift();
        if (!item) return null;
        this.processing.add(item.envelope.sessionId);
        return item.envelope;
    }

    /** Mark a reply as completed. */
    complete(sessionId: string): void {
        this.processing.delete(sessionId);
    }

    /** Mark a reply as failed, re-enqueue if retries remain. */
    fail(envelope: ReplyEnvelope, maxRetries = 2): boolean {
        this.processing.delete(envelope.sessionId);

        const existing = this.queue.find(q => q.envelope.sessionId === envelope.sessionId);
        if (existing && existing.attempts < maxRetries) {
            existing.attempts++;
            return true;
        }
        return false;
    }

    /** Check if a channel is rate limited. */
    private isRateLimited(channel: string): boolean {
        const now = Date.now();
        const cutoff = now - 60_000;
        let count = 0;

        for (const [, timestamp] of this.recentReplies) {
            if (timestamp > cutoff) count++;
        }

        return count >= this.rateLimitPerMinute;
    }

    /** Clean up old entries. */
    cleanup(maxAgeMs = 300_000): void {
        const cutoff = Date.now() - maxAgeMs;

        // Clean recent replies
        for (const [id, ts] of this.recentReplies) {
            if (ts < cutoff) this.recentReplies.delete(id);
        }

        // Clean expired queue items
        this.queue = this.queue.filter(q => q.addedAt > cutoff);
    }

    get size(): number { return this.queue.length; }
    get processingCount(): number { return this.processing.size; }
}
