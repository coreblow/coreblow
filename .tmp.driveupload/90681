/**
 * CoreBlow — Dead Letter Queue
 *
 * Stores failed messages for inspection, retry,
 * and analysis with configurable retention.
 */

/** Dead letter entry */
export interface DeadLetter {
    id: string;
    originalQueue: string;
    payload: unknown;
    error: string;
    attempts: number;
    failedAt: number;
    retried: boolean;
}

/**
 * CoreBlow Dead Letter Queue
 */
export class DeadLetterQueue {
    private letters: DeadLetter[] = [];
    private maxSize = 10_000;
    private idCounter = 0;

    /**
     * Add a dead letter.
     */
    add(originalQueue: string, payload: unknown, error: string, attempts: number): DeadLetter {
        const dl: DeadLetter = {
            id: `dl-${++this.idCounter}`, originalQueue, payload, error, attempts, failedAt: Date.now(), retried: false,
        };
        this.letters.push(dl);
        if (this.letters.length > this.maxSize) this.letters = this.letters.slice(-this.maxSize);
        return dl;
    }

    /**
     * Get letters by queue.
     */
    getByQueue(queue: string): DeadLetter[] {
        return this.letters.filter((dl) => dl.originalQueue === queue);
    }

    /**
     * Mark as retried.
     */
    markRetried(id: string): boolean {
        const dl = this.letters.find((l) => l.id === id);
        if (!dl) return false;
        dl.retried = true;
        return true;
    }

    /**
     * Get unretried letters.
     */
    getUnretried(): DeadLetter[] {
        return this.letters.filter((dl) => !dl.retried);
    }

    /**
     * Purge old letters.
     */
    purge(olderThanMs: number): number {
        const cutoff = Date.now() - olderThanMs;
        const before = this.letters.length;
        this.letters = this.letters.filter((dl) => dl.failedAt > cutoff);
        return before - this.letters.length;
    }

    /**
     * Get summary by queue.
     */
    summary(): Array<{ queue: string; count: number; unretried: number }> {
        const groups = new Map<string, { count: number; unretried: number }>();
        for (const dl of this.letters) {
            if (!groups.has(dl.originalQueue)) groups.set(dl.originalQueue, { count: 0, unretried: 0 });
            const g = groups.get(dl.originalQueue)!;
            g.count++;
            if (!dl.retried) g.unretried++;
        }
        return Array.from(groups).map(([queue, g]) => ({ queue, ...g }));
    }

    /** Count */
    count(): number { return this.letters.length; }
}
