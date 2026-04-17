/**
 * CoreBlow — Analytics Tracker
 *
 * Tracks usage analytics for agents, channels, and users.
 * Provides aggregation, trend analysis, and exportable reports.
 */

/** Analytics event */
export interface AnalyticsEvent {
    name: string;
    category: string;
    userId?: string;
    channel?: string;
    value?: number;
    metadata?: Record<string, unknown>;
    timestamp: number;
}

/** Analytics summary */
export interface AnalyticsSummary {
    totalEvents: number;
    uniqueUsers: number;
    eventsByCategory: Record<string, number>;
    eventsByName: Record<string, number>;
    topChannels: Array<{ channel: string; count: number }>;
    period: { from: number; to: number };
}

/**
 * CoreBlow Analytics Tracker
 */
export class AnalyticsTracker {
    private events: AnalyticsEvent[] = [];
    private maxEvents = 10_000;

    /**
     * Track an event.
     */
    track(name: string, category: string, opts?: { userId?: string; channel?: string; value?: number; metadata?: Record<string, unknown> }): void {
        this.events.push({
            name, category,
            userId: opts?.userId, channel: opts?.channel,
            value: opts?.value, metadata: opts?.metadata,
            timestamp: Date.now(),
        });
        if (this.events.length > this.maxEvents) this.events = this.events.slice(-this.maxEvents);
    }

    /**
     * Get summary for a time window.
     */
    summarize(windowMs?: number): AnalyticsSummary {
        const cutoff = windowMs ? Date.now() - windowMs : 0;
        const filtered = this.events.filter((e) => e.timestamp >= cutoff);

        const users = new Set(filtered.map((e) => e.userId).filter(Boolean));
        const byCategory: Record<string, number> = {};
        const byName: Record<string, number> = {};
        const channelCounts: Record<string, number> = {};

        for (const event of filtered) {
            byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;
            byName[event.name] = (byName[event.name] ?? 0) + 1;
            if (event.channel) channelCounts[event.channel] = (channelCounts[event.channel] ?? 0) + 1;
        }

        const topChannels = Object.entries(channelCounts)
            .map(([channel, count]) => ({ channel, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalEvents: filtered.length,
            uniqueUsers: users.size,
            eventsByCategory: byCategory,
            eventsByName: byName,
            topChannels,
            period: { from: cutoff || (filtered[0]?.timestamp ?? Date.now()), to: Date.now() },
        };
    }

    /**
     * Count events by name.
     */
    countByName(name: string, windowMs?: number): number {
        const cutoff = windowMs ? Date.now() - windowMs : 0;
        return this.events.filter((e) => e.name === name && e.timestamp >= cutoff).length;
    }

    /**
     * Get events for a user.
     */
    getUserEvents(userId: string, limit?: number): AnalyticsEvent[] {
        return this.events.filter((e) => e.userId === userId).slice(-(limit ?? 50));
    }

    /**
     * Export all events.
     */
    export(): AnalyticsEvent[] {
        return [...this.events];
    }

    /**
     * Clear events.
     */
    clear(): void {
        this.events = [];
    }

    /** Count */
    count(): number { return this.events.length; }
}
