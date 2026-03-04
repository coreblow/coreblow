/**
 * src/utils/dedup.ts
 * Message deduplication cache — prevents double-processing
 * from WhatsApp reconnect replays and channel retries
 */

import { createChildLogger } from './logger.js';

const log = createChildLogger('dedup');

export class DedupCache {
    private seen: Map<string, number> = new Map();
    private ttlMs: number;
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor(ttlMs = 60_000) {
        this.ttlMs = ttlMs;

        // Periodic cleanup every 30s
        this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
    }

    /**
     * Check if a message ID has been seen recently.
     * Returns true if it's a duplicate (already seen).
     */
    isDuplicate(messageId: string): boolean {
        const now = Date.now();

        if (this.seen.has(messageId)) {
            const seenAt = this.seen.get(messageId)!;
            if (now - seenAt < this.ttlMs) {
                log.debug({ messageId }, 'Duplicate message filtered');
                return true;
            }
        }

        this.seen.set(messageId, now);
        return false;
    }

    /**
     * Generate a dedup key from message components
     */
    static key(channel: string, senderId: string, text: string, timestamp?: number): string {
        // Use first 50 chars of text + timestamp bucket (5s window)
        const textSlice = text.slice(0, 50);
        const timeBucket = timestamp ? Math.floor(timestamp / 5000) : Math.floor(Date.now() / 5000);
        return `${channel}:${senderId}:${textSlice}:${timeBucket}`;
    }

    private cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [id, seenAt] of this.seen) {
            if (now - seenAt > this.ttlMs) {
                this.seen.delete(id);
                removed++;
            }
        }
        if (removed > 0) {
            log.debug({ removed, remaining: this.seen.size }, 'Dedup cache cleanup');
        }
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.seen.clear();
    }
}
