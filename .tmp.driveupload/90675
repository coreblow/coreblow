/**
 * CoreBlow — Event Sourcing
 *
 * Event sourcing pattern for reconstructing state from
 * an ordered sequence of events. Supports snapshots,
 * projections, and event replay.
 */

/** Domain event */
export interface DomainEvent {
    id: string;
    type: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    timestamp: number;
    version: number;
}

/** Snapshot */
export interface Snapshot {
    aggregateId: string;
    state: Record<string, unknown>;
    version: number;
    createdAt: number;
}

/**
 * CoreBlow Event Sourcing
 */
export class EventStore {
    private events: DomainEvent[] = [];
    private snapshots = new Map<string, Snapshot>();
    private projections = new Map<string, (state: Record<string, unknown>, event: DomainEvent) => Record<string, unknown>>();
    private idCounter = 0;
    private versionCounters = new Map<string, number>();

    /**
     * Append an event.
     */
    append(type: string, aggregateId: string, payload: Record<string, unknown>): DomainEvent {
        const version = (this.versionCounters.get(aggregateId) ?? 0) + 1;
        this.versionCounters.set(aggregateId, version);

        const event: DomainEvent = {
            id: `evt-${++this.idCounter}`, type, aggregateId,
            payload, timestamp: Date.now(), version,
        };
        this.events.push(event);
        return event;
    }

    /**
     * Get events for an aggregate.
     */
    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
        return this.events.filter((e) => e.aggregateId === aggregateId && e.version > (afterVersion ?? 0));
    }

    /**
     * Register a projection (reducer function).
     */
    registerProjection(name: string, reducer: (state: Record<string, unknown>, event: DomainEvent) => Record<string, unknown>): void {
        this.projections.set(name, reducer);
    }

    /**
     * Replay events through a projection to build state.
     */
    project(projectionName: string, aggregateId: string): Record<string, unknown> {
        const reducer = this.projections.get(projectionName);
        if (!reducer) return {};

        // Start from snapshot if available
        const snapshot = this.snapshots.get(aggregateId);
        let state = snapshot?.state ?? {};
        const afterVersion = snapshot?.version ?? 0;

        const events = this.getEvents(aggregateId, afterVersion);
        for (const event of events) state = reducer(state, event);
        return state;
    }

    /**
     * Create a snapshot.
     */
    createSnapshot(aggregateId: string, state: Record<string, unknown>): Snapshot {
        const version = this.versionCounters.get(aggregateId) ?? 0;
        const snapshot: Snapshot = { aggregateId, state, version, createdAt: Date.now() };
        this.snapshots.set(aggregateId, snapshot);
        return snapshot;
    }

    /**
     * Get all events by type.
     */
    getByType(type: string): DomainEvent[] {
        return this.events.filter((e) => e.type === type);
    }

    /**
     * Get latest version for aggregate.
     */
    getVersion(aggregateId: string): number {
        return this.versionCounters.get(aggregateId) ?? 0;
    }

    /** Count events */
    count(): number { return this.events.length; }
}
