import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './event-bus.js';

describe('EventBus', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus();
    });

    // === on/emit ===

    describe('on + emit', () => {
        it('calls handler on emit', async () => {
            let received: unknown = null;
            bus.on('test', (data) => { received = data; });
            await bus.emit('test', { msg: 'hello' });
            expect(received).toEqual({ msg: 'hello' });
        });

        it('calls multiple handlers', async () => {
            let count = 0;
            bus.on('evt', () => { count++; });
            bus.on('evt', () => { count++; });
            const handled = await bus.emit('evt');
            expect(handled).toBe(2);
            expect(count).toBe(2);
        });

        it('returns 0 for events with no handlers', async () => {
            expect(await bus.emit('nobody')).toBe(0);
        });

        it('persists handler across multiple emits', async () => {
            let count = 0;
            bus.on('evt', () => { count++; });
            await bus.emit('evt');
            await bus.emit('evt');
            await bus.emit('evt');
            expect(count).toBe(3);
        });
    });

    // === once ===

    describe('once', () => {
        it('fires handler only once', async () => {
            let count = 0;
            bus.once('evt', () => { count++; });
            await bus.emit('evt');
            await bus.emit('evt');
            expect(count).toBe(1);
        });

        it('removes handler after first fire', async () => {
            bus.once('evt', () => {});
            await bus.emit('evt');
            expect(await bus.emit('evt')).toBe(0);
        });
    });

    // === off ===

    describe('off', () => {
        it('removes a specific handler', async () => {
            let count = 0;
            const handler = () => { count++; };
            bus.on('evt', handler);
            bus.off('evt', handler);
            await bus.emit('evt');
            expect(count).toBe(0);
        });

        it('does not affect other handlers', async () => {
            let a = 0, b = 0;
            const handlerA = () => { a++; };
            const handlerB = () => { b++; };
            bus.on('evt', handlerA);
            bus.on('evt', handlerB);
            bus.off('evt', handlerA);
            await bus.emit('evt');
            expect(a).toBe(0);
            expect(b).toBe(1);
        });

        it('does nothing for unknown event', () => {
            bus.off('ghost', () => {}); // should not throw
        });
    });

    // === Async handlers ===

    describe('async handlers', () => {
        it('awaits async handlers', async () => {
            let value = '';
            bus.on('async', async () => {
                await new Promise(r => setTimeout(r, 10));
                value = 'done';
            });
            await bus.emit('async');
            expect(value).toBe('done');
        });
    });

    // === History ===

    describe('getHistory', () => {
        it('records event history', async () => {
            await bus.emit('a', 1);
            await bus.emit('b', 2);
            const history = bus.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]?.event).toBe('a');
            expect(history[1]?.event).toBe('b');
        });

        it('filters by event name', async () => {
            await bus.emit('a', 1);
            await bus.emit('b', 2);
            await bus.emit('a', 3);
            const history = bus.getHistory('a');
            expect(history).toHaveLength(2);
        });

        it('respects limit', async () => {
            for (let i = 0; i < 10; i++) await bus.emit('evt', i);
            const history = bus.getHistory(undefined, 3);
            expect(history).toHaveLength(3);
        });

        it('includes timestamps', async () => {
            const before = Date.now();
            await bus.emit('timed');
            const entry = bus.getHistory('timed')[0];
            expect(entry?.timestamp).toBeGreaterThanOrEqual(before);
        });
    });

    // === Stats ===

    describe('getStats', () => {
        it('tracks emitted and handled counts', async () => {
            bus.on('evt', () => {});
            await bus.emit('evt');
            await bus.emit('evt');
            await bus.emit('empty'); // no handler
            const stats = bus.getStats();
            expect(stats.emitted).toBe(3);
            expect(stats.handled).toBe(2);
        });
    });

    // === listEvents ===

    describe('listEvents', () => {
        it('lists events with handler counts', () => {
            bus.on('a', () => {});
            bus.on('a', () => {});
            bus.on('b', () => {});
            const list = bus.listEvents();
            expect(list.find(e => e.event === 'a')?.handlers).toBe(2);
            expect(list.find(e => e.event === 'b')?.handlers).toBe(1);
        });
    });
});
