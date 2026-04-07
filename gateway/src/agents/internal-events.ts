/**
 * agents/internal-events.ts
 * Internal event bus for agent subsystem communication.
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export class InternalEventBus {
    private handlers = new Map<string, EventHandler[]>();
    on<T>(event: string, handler: EventHandler<T>): () => void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler as EventHandler);
        this.handlers.set(event, list);
        return () => { const idx = list.indexOf(handler as EventHandler); if (idx >= 0) list.splice(idx, 1); };
    }
    once<T>(event: string, handler: EventHandler<T>): () => void {
        const wrapper: EventHandler<T> = (data) => { unsub(); handler(data); };
        const unsub = this.on(event, wrapper);
        return unsub;
    }
    async emit<T>(event: string, data: T): Promise<void> {
        const list = this.handlers.get(event) ?? [];
        for (const handler of [...list]) await handler(data);
    }
    emitSync<T>(event: string, data: T): void {
        const list = this.handlers.get(event) ?? [];
        for (const handler of [...list]) { try { const result = handler(data); if (result instanceof Promise) result.catch(() => {}); } catch { /* swallow sync errors */ } }
    }
    off(event: string): void { this.handlers.delete(event); }
    clear(): void { this.handlers.clear(); }
    listenerCount(event: string): number { return (this.handlers.get(event) ?? []).length; }
    events(): string[] { return [...this.handlers.keys()]; }
}

export const agentEvents = new InternalEventBus();
