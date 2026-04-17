/**
 * plugin-sdk/event-emitter.ts
 * Plugin event subscription system.
 */

export type PluginEventType =
    | 'message.inbound'
    | 'message.outbound'
    | 'agent.turn.start'
    | 'agent.turn.end'
    | 'tool.call'
    | 'tool.result'
    | 'config.change'
    | 'session.start'
    | 'session.end'
    | 'plugin.load'
    | 'plugin.unload'
    | 'heartbeat';

export interface PluginEvent<T = unknown> {
    type: PluginEventType;
    timestamp: number;
    source: string;
    data: T;
}

export type PluginEventHandler<T = unknown> = (event: PluginEvent<T>) => void | Promise<void>;

/**
 * Create a typed event emitter for plugin events.
 */
export function createPluginEventEmitter() {
    const handlers = new Map<PluginEventType, Set<PluginEventHandler>>();

    function on<T>(type: PluginEventType, handler: PluginEventHandler<T>): () => void {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type)!.add(handler as PluginEventHandler);
        return () => off(type, handler);
    }

    function off<T>(type: PluginEventType, handler: PluginEventHandler<T>): void {
        handlers.get(type)?.delete(handler as PluginEventHandler);
    }

    function once<T>(type: PluginEventType, handler: PluginEventHandler<T>): () => void {
        const wrapper: PluginEventHandler<T> = (event) => {
            off(type, wrapper);
            return handler(event);
        };
        return on(type, wrapper);
    }

    async function emit<T>(type: PluginEventType, data: T, source = 'plugin'): Promise<void> {
        const event: PluginEvent<T> = { type, timestamp: Date.now(), source, data };
        const typeHandlers = handlers.get(type);
        if (!typeHandlers || typeHandlers.size === 0) return;
        const promises = [...typeHandlers].map((handler) => {
            try { return Promise.resolve(handler(event as PluginEvent)); }
            catch (err) { return Promise.reject(err); }
        });
        await Promise.allSettled(promises);
    }

    function listenerCount(type: PluginEventType): number {
        return handlers.get(type)?.size ?? 0;
    }

    function removeAllListeners(type?: PluginEventType): void {
        if (type) handlers.delete(type);
        else handlers.clear();
    }

    return { on, off, once, emit, listenerCount, removeAllListeners };
}
