import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from './event-sourcing.js';

describe('EventStore', () => {
    let store: EventStore;

    beforeEach(() => {
        store = new EventStore();
    });

    // === Append ===

    describe('append', () => {
        it('appends an event with auto-ID', () => {
            const evt = store.append('created', 'order-1', { item: 'widget' });
            expect(evt.id).toMatch(/^evt-/);
            expect(evt.type).toBe('created');
            expect(evt.aggregateId).toBe('order-1');
            expect(evt.payload).toEqual({ item: 'widget' });
            expect(evt.version).toBe(1);
        });

        it('increments version per aggregate', () => {
            store.append('created', 'order-1', {});
            const evt2 = store.append('updated', 'order-1', {});
            expect(evt2.version).toBe(2);
        });

        it('tracks versions independently per aggregate', () => {
            store.append('created', 'a', {});
            store.append('created', 'b', {});
            const evt = store.append('updated', 'a', {});
            expect(evt.version).toBe(2);
            expect(store.getVersion('b')).toBe(1);
        });
    });

    // === getEvents ===

    describe('getEvents', () => {
        it('returns events for aggregate', () => {
            store.append('created', 'order-1', {});
            store.append('updated', 'order-1', {});
            store.append('created', 'order-2', {});

            const events = store.getEvents('order-1');
            expect(events).toHaveLength(2);
        });

        it('filters by afterVersion', () => {
            store.append('created', 'a', {});
            store.append('updated', 'a', {});
            store.append('shipped', 'a', {});

            const events = store.getEvents('a', 1);
            expect(events).toHaveLength(2); // versions 2 and 3
            expect(events[0]?.type).toBe('updated');
        });

        it('returns empty for unknown aggregate', () => {
            expect(store.getEvents('ghost')).toHaveLength(0);
        });
    });

    // === Projections ===

    describe('project', () => {
        it('replays events through reducer', () => {
            store.registerProjection('order-total', (state, event) => {
                if (event.type === 'item_added') {
                    return { total: ((state.total as number) || 0) + (event.payload.price as number) };
                }
                return state;
            });

            store.append('item_added', 'cart-1', { price: 10 });
            store.append('item_added', 'cart-1', { price: 25 });

            const state = store.project('order-total', 'cart-1');
            expect(state.total).toBe(35);
        });

        it('returns empty for unknown projection', () => {
            expect(store.project('nonexistent', 'x')).toEqual({});
        });
    });

    // === Snapshots ===

    describe('createSnapshot + project', () => {
        it('project starts from snapshot state', () => {
            store.registerProjection('counter', (state, event) => {
                if (event.type === 'inc') {
                    return { count: ((state.count as number) || 0) + 1 };
                }
                return state;
            });

            store.append('inc', 'c', {});
            store.append('inc', 'c', {});
            store.createSnapshot('c', { count: 2 }); // snapshot at version 2

            store.append('inc', 'c', {}); // version 3

            const state = store.project('counter', 'c');
            expect(state.count).toBe(3); // 2 from snapshot + 1 from replay
        });
    });

    // === Filtering ===

    describe('getByType', () => {
        it('returns events across aggregates by type', () => {
            store.append('created', 'a', {});
            store.append('created', 'b', {});
            store.append('updated', 'a', {});

            const created = store.getByType('created');
            expect(created).toHaveLength(2);
        });
    });

    // === Version + Count ===

    describe('getVersion', () => {
        it('returns 0 for unknown aggregate', () => {
            expect(store.getVersion('ghost')).toBe(0);
        });
    });

    describe('count', () => {
        it('returns total event count', () => {
            store.append('a', 'x', {});
            store.append('b', 'y', {});
            expect(store.count()).toBe(2);
        });
    });
});
