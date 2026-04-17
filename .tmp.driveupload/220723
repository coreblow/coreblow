/**
 * infra/collector.ts
 * Metrics and event collector — aggregates telemetry data.
 */

export interface CollectorEvent {
    type: string;
    timestamp: number;
    data?: Record<string, unknown>;
}

export class MetricsCollector {
    private events: CollectorEvent[] = [];
    private counters = new Map<string, number>();
    private maxEvents: number;

    constructor(maxEvents = 10_000) {
        this.maxEvents = maxEvents;
    }

    record(type: string, data?: Record<string, unknown>): void {
        this.events.push({ type, timestamp: Date.now(), data });
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }
        this.counters.set(type, (this.counters.get(type) ?? 0) + 1);
    }

    increment(metric: string, delta = 1): void {
        this.counters.set(metric, (this.counters.get(metric) ?? 0) + delta);
    }

    getCount(metric: string): number {
        return this.counters.get(metric) ?? 0;
    }

    getEvents(type?: string, limit = 100): CollectorEvent[] {
        const filtered = type ? this.events.filter(e => e.type === type) : this.events;
        return filtered.slice(-limit);
    }

    reset(): void {
        this.events.length = 0;
        this.counters.clear();
    }
}
