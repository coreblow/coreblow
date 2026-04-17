/**
 * CoreBlow — Event Bus
 *
 * Typed event bus with namespaced events, once
 * listeners, async handlers, and event history.
 */

/** Event entry */
export interface EventEntry {
    event: string;
    data: unknown;
    timestamp: number;
}

/**
 * CoreBlow Event Bus
 */
export class EventBus {
    private handlers = new Map<string, Array<{ fn: (data: unknown) => void | Promise<void>; once: boolean }>>();
    private history: EventEntry[] = [];
    private maxHistory = 500;
    private stats = { emitted: 0, handled: 0 };

    /**
     * Listen for an event.
     */
    on(event: string, fn: (data: unknown) => void | Promise<void>): void {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event)!.push({ fn, once: false });
    }

    /**
     * Listen once.
     */
    once(event: string, fn: (data: unknown) => void | Promise<void>): void {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event)!.push({ fn, once: true });
    }

    /**
     * Remove listener.
     */
    off(event: string, fn: (data: unknown) => void | Promise<void>): void {
        const handlers = this.handlers.get(event);
        if (!handlers) return;
        const idx = handlers.findIndex((h) => h.fn === fn);
        if (idx !== -1) handlers.splice(idx, 1);
    }

    /**
     * Emit an event.
     */
    async emit(event: string, data?: unknown): Promise<number> {
        this.stats.emitted++;
        this.history.push({ event, data, timestamp: Date.now() });
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);

        const handlers = this.handlers.get(event);
        if (!handlers || handlers.length === 0) return 0;

        let handled = 0;
        const toRemove: number[] = [];

        for (let i = 0; i < handlers.length; i++) {
            const h = handlers[i]!;
            await h.fn(data);
            handled++;
            if (h.once) toRemove.push(i);
        }

        // Remove once handlers (reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) handlers.splice(toRemove[i]!, 1);

        this.stats.handled += handled;
        return handled;
    }

    /**
     * Get event history.
     */
    getHistory(event?: string, limit?: number): EventEntry[] {
        let entries = event ? this.history.filter((e) => e.event === event) : this.history;
        return entries.slice(-(limit ?? 50));
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List events with handler counts.
     */
    listEvents(): Array<{ event: string; handlers: number }> {
        return Array.from(this.handlers).map(([event, h]) => ({ event, handlers: h.length }));
    }
}
