/**
 * CoreBlow — Pub/Sub
 *
 * Publish-subscribe messaging with topics, wildcard
 * subscriptions, and message filtering.
 */

/** Subscription */
export interface Subscription {
    id: string;
    topic: string;
    handler: (topic: string, data: unknown) => void;
    filter?: (data: unknown) => boolean;
}

/**
 * CoreBlow Pub/Sub
 */
export class PubSub {
    private subscriptions = new Map<string, Subscription[]>();
    private idCounter = 0;
    private stats = { published: 0, delivered: 0, filtered: 0 };

    /**
     * Subscribe to a topic.
     */
    subscribe(topic: string, handler: Subscription['handler'], filter?: Subscription['filter']): string {
        if (!this.subscriptions.has(topic)) this.subscriptions.set(topic, []);
        const id = `sub-${++this.idCounter}`;
        this.subscriptions.get(topic)!.push({ id, topic, handler, filter });
        return id;
    }

    /**
     * Unsubscribe.
     */
    unsubscribe(subscriptionId: string): boolean {
        for (const [topic, subs] of Array.from(this.subscriptions)) {
            const idx = subs.findIndex((s) => s.id === subscriptionId);
            if (idx !== -1) { subs.splice(idx, 1); return true; }
        }
        return false;
    }

    /**
     * Publish to a topic.
     */
    publish(topic: string, data: unknown): number {
        this.stats.published++;
        let delivered = 0;

        // Exact match
        const exact = this.subscriptions.get(topic) ?? [];
        for (const sub of exact) {
            if (sub.filter && !sub.filter(data)) { this.stats.filtered++; continue; }
            sub.handler(topic, data);
            delivered++;
        }

        // Wildcard match
        for (const [pattern, subs] of Array.from(this.subscriptions)) {
            if (pattern === topic) continue;
            if (this.matchWildcard(pattern, topic)) {
                for (const sub of subs) {
                    if (sub.filter && !sub.filter(data)) { this.stats.filtered++; continue; }
                    sub.handler(topic, data);
                    delivered++;
                }
            }
        }

        this.stats.delivered += delivered;
        return delivered;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List topics.
     */
    listTopics(): Array<{ topic: string; subscribers: number }> {
        return Array.from(this.subscriptions).map(([topic, subs]) => ({ topic, subscribers: subs.length }));
    }

    /** Count subscriptions */
    count(): number {
        let total = 0;
        for (const subs of Array.from(this.subscriptions.values())) total += subs.length;
        return total;
    }

    // === Private ===
    private matchWildcard(pattern: string, topic: string): boolean {
        if (pattern === '#') return true;
        const pp = pattern.split('.');
        const tp = topic.split('.');
        for (let i = 0; i < pp.length; i++) {
            if (pp[i] === '#') return true;
            if (pp[i] === '*') continue;
            if (pp[i] !== tp[i]) return false;
        }
        return pp.length === tp.length;
    }
}
