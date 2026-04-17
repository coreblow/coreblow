/**
 * plugins/event-bus.ts
 *
 * Plugin Event Bus — centralized pub/sub system for inter-plugin
 * communication and cross-cutting event propagation.
 *
 * Following CoreBlow's hooks/event-bus.ts (~520 LOC) + hooks/event-types.ts
 * (~180 LOC) pattern, adapted for CoreBlow's OOP architecture with typed
 * events, namespace isolation, and replay/history capabilities.
 *
 * Features:
 *   - Typed event subscriptions with plugin namespace isolation
 *   - Wildcard listeners (listen to all events)
 *   - Event history + replay for late subscribers
 *   - Priority-ordered delivery
 *   - Error isolation (one handler failure doesn't crash others)
 *   - Event filtering and transformation
 *   - Metrics collection (emit/subscribe/error counts)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:event-bus');

// ─── Types ──────────────────────────────────────────────────────

export interface PluginEvent {
    type: string;
    source: string;
    timestamp: number;
    data: unknown;
    meta?: Record<string, unknown>;
}

export interface EventSubscription {
    id: string;
    eventType: string;
    pluginId: string;
    handler: EventHandler;
    priority: number;
    once: boolean;
    filter?: EventFilter;
}

export type EventHandler = (event: PluginEvent) => void | Promise<void>;
export type EventFilter = (event: PluginEvent) => boolean;

export interface EventBusStats {
    totalEmitted: number;
    totalDelivered: number;
    totalErrors: number;
    subscriptionCount: number;
    eventTypes: string[];
    historySize: number;
    byType: Record<string, { emitted: number; delivered: number; errors: number }>;
}

export interface EventBusOptions {
    maxHistory?: number;
    enableReplay?: boolean;
    enableWildcard?: boolean;
}

// ─── PluginEventBus ─────────────────────────────────────────────

/**
 * PluginEventBus
 *
 * OOP equivalent of CoreBlow's createEventBus() factory.
 * Provides typed event pub/sub with namespace isolation,
 * replay, priority ordering, and error containment.
 */
export class PluginEventBus {
    private subscriptions = new Map<string, EventSubscription[]>();
    private wildcardSubs: EventSubscription[] = [];
    private history: PluginEvent[] = [];
    private maxHistory: number;
    private enableReplay: boolean;
    private enableWildcard: boolean;
    private nextSubId = 1;

    // Stats
    private stats = {
        totalEmitted: 0,
        totalDelivered: 0,
        totalErrors: 0,
        byType: new Map<string, { emitted: number; delivered: number; errors: number }>(),
    };

    constructor(options: EventBusOptions = {}) {
        this.maxHistory = options.maxHistory ?? 1000;
        this.enableReplay = options.enableReplay ?? true;
        this.enableWildcard = options.enableWildcard ?? true;
    }

    // ─── Emit ───────────────────────────────────────────────────

    /**
     * Emit an event to all matching subscribers.
     */
    async emit(type: string, source: string, data: unknown, meta?: Record<string, unknown>): Promise<number> {
        const event: PluginEvent = {
            type,
            source,
            timestamp: Date.now(),
            data,
            meta,
        };

        // Record history
        this.history.push(event);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }

        // Update stats
        this.stats.totalEmitted++;
        const typeStats = this.getTypeStats(type);
        typeStats.emitted++;

        // Get matching subscriptions
        const subs = this.getMatchingSubs(type);

        // Sort by priority (lower = higher priority)
        subs.sort((a, b) => a.priority - b.priority);

        let delivered = 0;

        for (const sub of subs) {
            // Apply filter
            if (sub.filter && !sub.filter(event)) continue;

            try {
                await sub.handler(event);
                delivered++;
                this.stats.totalDelivered++;
                typeStats.delivered++;
            } catch (err) {
                this.stats.totalErrors++;
                typeStats.errors++;
                log.error({ err, eventType: type, subId: sub.id, pluginId: sub.pluginId }, 'Event handler error');
            }

            // Remove once-subscriptions after firing
            if (sub.once) {
                this.unsubscribe(sub.id);
            }
        }

        return delivered;
    }

    /**
     * Emit synchronously (fire-and-forget).
     */
    emitSync(type: string, source: string, data: unknown, meta?: Record<string, unknown>): void {
        void this.emit(type, source, data, meta);
    }

    // ─── Subscribe ──────────────────────────────────────────────

    /**
     * Subscribe to an event type. Returns unsubscribe function.
     */
    on(eventType: string, pluginId: string, handler: EventHandler, options?: {
        priority?: number;
        filter?: EventFilter;
    }): () => void {
        const sub = this.createSub(eventType, pluginId, handler, false, options?.priority, options?.filter);
        return () => this.unsubscribe(sub.id);
    }

    /**
     * Subscribe to an event type, fire only once.
     */
    once(eventType: string, pluginId: string, handler: EventHandler, options?: {
        priority?: number;
        filter?: EventFilter;
    }): () => void {
        const sub = this.createSub(eventType, pluginId, handler, true, options?.priority, options?.filter);
        return () => this.unsubscribe(sub.id);
    }

    /**
     * Subscribe to all events (wildcard).
     */
    onAny(pluginId: string, handler: EventHandler, priority = 100): () => void {
        if (!this.enableWildcard) {
            throw new Error('Wildcard subscriptions are disabled');
        }

        const sub: EventSubscription = {
            id: `sub-${this.nextSubId++}`,
            eventType: '*',
            pluginId,
            handler,
            priority,
            once: false,
        };
        this.wildcardSubs.push(sub);
        return () => this.unsubscribe(sub.id);
    }

    /**
     * Unsubscribe by subscription ID.
     */
    unsubscribe(subId: string): boolean {
        // Check typed subscriptions
        for (const [type, subs] of this.subscriptions) {
            const idx = subs.findIndex(s => s.id === subId);
            if (idx >= 0) {
                subs.splice(idx, 1);
                if (subs.length === 0) this.subscriptions.delete(type);
                return true;
            }
        }

        // Check wildcard
        const wcIdx = this.wildcardSubs.findIndex(s => s.id === subId);
        if (wcIdx >= 0) {
            this.wildcardSubs.splice(wcIdx, 1);
            return true;
        }

        return false;
    }

    /**
     * Remove all subscriptions for a plugin.
     */
    removePlugin(pluginId: string): number {
        let removed = 0;

        for (const [type, subs] of this.subscriptions) {
            const before = subs.length;
            const filtered = subs.filter(s => s.pluginId !== pluginId);
            removed += before - filtered.length;
            if (filtered.length === 0) {
                this.subscriptions.delete(type);
            } else {
                this.subscriptions.set(type, filtered);
            }
        }

        const wcBefore = this.wildcardSubs.length;
        this.wildcardSubs = this.wildcardSubs.filter(s => s.pluginId !== pluginId);
        removed += wcBefore - this.wildcardSubs.length;

        return removed;
    }

    // ─── Replay ─────────────────────────────────────────────────

    /**
     * Replay historical events to a handler (for late subscribers).
     */
    async replay(eventType: string, handler: EventHandler, limit?: number): Promise<number> {
        if (!this.enableReplay) {
            throw new Error('Replay is disabled');
        }

        let events = this.history.filter(e => e.type === eventType);
        if (limit) events = events.slice(-limit);

        let replayed = 0;
        for (const event of events) {
            try {
                await handler(event);
                replayed++;
            } catch (err) {
                log.error({ err, eventType }, 'Replay handler error');
            }
        }
        return replayed;
    }

    // ─── Query ──────────────────────────────────────────────────

    /**
     * Get event history, optionally filtered.
     */
    getHistory(options?: { type?: string; source?: string; limit?: number }): PluginEvent[] {
        let events = [...this.history];

        if (options?.type) events = events.filter(e => e.type === options.type);
        if (options?.source) events = events.filter(e => e.source === options.source);
        if (options?.limit) events = events.slice(-options.limit);

        return events;
    }

    /**
     * Get all registered event types.
     */
    getEventTypes(): string[] {
        return [...this.subscriptions.keys()];
    }

    /**
     * Get subscription count for a type.
     */
    getSubscriptionCount(eventType?: string): number {
        if (eventType) {
            return (this.subscriptions.get(eventType)?.length ?? 0);
        }
        let count = 0;
        for (const subs of this.subscriptions.values()) count += subs.length;
        count += this.wildcardSubs.length;
        return count;
    }

    /**
     * Get subscriptions for a specific plugin.
     */
    getPluginSubscriptions(pluginId: string): EventSubscription[] {
        const result: EventSubscription[] = [];
        for (const subs of this.subscriptions.values()) {
            result.push(...subs.filter(s => s.pluginId === pluginId));
        }
        result.push(...this.wildcardSubs.filter(s => s.pluginId === pluginId));
        return result;
    }

    // ─── Stats ──────────────────────────────────────────────────

    /**
     * Get event bus statistics.
     */
    getStats(): EventBusStats {
        const byType: Record<string, { emitted: number; delivered: number; errors: number }> = {};
        for (const [type, stats] of this.stats.byType) {
            byType[type] = { ...stats };
        }

        return {
            totalEmitted: this.stats.totalEmitted,
            totalDelivered: this.stats.totalDelivered,
            totalErrors: this.stats.totalErrors,
            subscriptionCount: this.getSubscriptionCount(),
            eventTypes: this.getEventTypes(),
            historySize: this.history.length,
            byType,
        };
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    /**
     * Clear all subscriptions and history.
     */
    clear(): void {
        this.subscriptions.clear();
        this.wildcardSubs = [];
        this.history = [];
        this.stats = {
            totalEmitted: 0, totalDelivered: 0, totalErrors: 0,
            byType: new Map(),
        };
        this.nextSubId = 1;
    }

    // ─── Private ────────────────────────────────────────────────

    private createSub(
        eventType: string,
        pluginId: string,
        handler: EventHandler,
        once: boolean,
        priority = 100,
        filter?: EventFilter,
    ): EventSubscription {
        const sub: EventSubscription = {
            id: `sub-${this.nextSubId++}`,
            eventType,
            pluginId,
            handler,
            priority,
            once,
            filter,
        };

        const subs = this.subscriptions.get(eventType) ?? [];
        subs.push(sub);
        this.subscriptions.set(eventType, subs);

        return sub;
    }

    private getMatchingSubs(eventType: string): EventSubscription[] {
        const typed = this.subscriptions.get(eventType) ?? [];
        if (this.enableWildcard) {
            return [...typed, ...this.wildcardSubs];
        }
        return [...typed];
    }

    private getTypeStats(type: string): { emitted: number; delivered: number; errors: number } {
        let stats = this.stats.byType.get(type);
        if (!stats) {
            stats = { emitted: 0, delivered: 0, errors: 0 };
            this.stats.byType.set(type, stats);
        }
        return stats;
    }
}
