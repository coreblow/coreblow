import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    PluginEventBus,
    type PluginEvent,
    type EventHandler,
} from '../../src/plugins/event-bus.js';

// ═══════════════════════════════════════════════════════════════════
// Core Emit / Subscribe
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Emit & Subscribe', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('delivers event to subscriber', async () => {
        const events: PluginEvent[] = [];
        bus.on('message.received', 'test-plugin', (e) => { events.push(e); });

        const delivered = await bus.emit('message.received', 'core', { text: 'hello' });
        expect(delivered).toBe(1);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('message.received');
        expect(events[0].source).toBe('core');
        expect(events[0].data).toEqual({ text: 'hello' });
    });

    it('delivers to multiple subscribers', async () => {
        let count = 0;
        bus.on('tick', 'plugin-a', () => { count++; });
        bus.on('tick', 'plugin-b', () => { count++; });
        bus.on('tick', 'plugin-c', () => { count++; });

        const delivered = await bus.emit('tick', 'system', null);
        expect(delivered).toBe(3);
        expect(count).toBe(3);
    });

    it('does not deliver to unrelated event subscribers', async () => {
        let called = false;
        bus.on('other.event', 'test', () => { called = true; });

        await bus.emit('my.event', 'core', null);
        expect(called).toBe(false);
    });

    it('returns 0 when no subscribers', async () => {
        const delivered = await bus.emit('nobody.listening', 'core', null);
        expect(delivered).toBe(0);
    });

    it('includes timestamp and meta', async () => {
        const events: PluginEvent[] = [];
        bus.on('test', 'plugin', (e) => { events.push(e); });

        await bus.emit('test', 'core', 'data', { requestId: '123' });
        expect(events[0].timestamp).toBeGreaterThan(0);
        expect(events[0].meta).toEqual({ requestId: '123' });
    });

    it('handles async handlers', async () => {
        let result = '';
        bus.on('async', 'plugin', async () => {
            await new Promise(r => setTimeout(r, 5));
            result = 'done';
        });

        await bus.emit('async', 'core', null);
        expect(result).toBe('done');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Unsubscribe
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Unsubscribe', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('unsubscribes via returned function', async () => {
        let count = 0;
        const unsub = bus.on('test', 'plugin', () => { count++; });

        await bus.emit('test', 'core', null);
        expect(count).toBe(1);

        unsub();
        await bus.emit('test', 'core', null);
        expect(count).toBe(1); // not called again
    });

    it('once fires only once', async () => {
        let count = 0;
        bus.once('fire-once', 'plugin', () => { count++; });

        await bus.emit('fire-once', 'core', null);
        await bus.emit('fire-once', 'core', null);
        await bus.emit('fire-once', 'core', null);
        expect(count).toBe(1);
    });

    it('removePlugin clears all subscriptions', async () => {
        let countA = 0, countB = 0;
        bus.on('test', 'plugin-a', () => { countA++; });
        bus.on('test', 'plugin-b', () => { countB++; });
        bus.on('other', 'plugin-a', () => { countA++; });

        const removed = bus.removePlugin('plugin-a');
        expect(removed).toBe(2);

        await bus.emit('test', 'core', null);
        await bus.emit('other', 'core', null);
        expect(countA).toBe(0);
        expect(countB).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Priority
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Priority', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('delivers in priority order (lower = first)', async () => {
        const order: string[] = [];

        bus.on('ordered', 'low', () => { order.push('low'); }, { priority: 100 });
        bus.on('ordered', 'high', () => { order.push('high'); }, { priority: 10 });
        bus.on('ordered', 'medium', () => { order.push('medium'); }, { priority: 50 });

        await bus.emit('ordered', 'core', null);
        expect(order).toEqual(['high', 'medium', 'low']);
    });

    it('default priority is 100', async () => {
        const order: string[] = [];

        bus.on('default', 'a', () => { order.push('a'); }); // default 100
        bus.on('default', 'b', () => { order.push('b'); }, { priority: 50 });

        await bus.emit('default', 'core', null);
        expect(order).toEqual(['b', 'a']);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Wildcard
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Wildcard', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('wildcard receives all events', async () => {
        const events: string[] = [];
        bus.onAny('monitor', (e) => { events.push(e.type); });

        await bus.emit('type.a', 'core', null);
        await bus.emit('type.b', 'core', null);
        await bus.emit('type.c', 'core', null);

        expect(events).toEqual(['type.a', 'type.b', 'type.c']);
    });

    it('wildcard can be unsubscribed', async () => {
        let count = 0;
        const unsub = bus.onAny('monitor', () => { count++; });

        await bus.emit('test', 'core', null);
        unsub();
        await bus.emit('test', 'core', null);

        expect(count).toBe(1);
    });

    it('throws when wildcard is disabled', () => {
        const strictBus = new PluginEventBus({ enableWildcard: false });
        expect(() => strictBus.onAny('plugin', () => {})).toThrow('disabled');
    });

    it('removePlugin removes wildcard subs too', async () => {
        let count = 0;
        bus.onAny('plugin-x', () => { count++; });
        bus.on('test', 'plugin-x', () => { count++; });

        bus.removePlugin('plugin-x');
        await bus.emit('test', 'core', null);
        expect(count).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Filter
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Filter', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('filters events based on predicate', async () => {
        const events: PluginEvent[] = [];
        bus.on('data', 'plugin', (e) => { events.push(e); }, {
            filter: (e) => (e.data as any).important === true,
        });

        await bus.emit('data', 'core', { important: true, msg: 'yes' });
        await bus.emit('data', 'core', { important: false, msg: 'no' });
        await bus.emit('data', 'core', { important: true, msg: 'also yes' });

        expect(events).toHaveLength(2);
    });

    it('filtered events do not count as delivered', async () => {
        bus.on('data', 'plugin', () => {}, {
            filter: () => false,
        });

        const delivered = await bus.emit('data', 'core', null);
        expect(delivered).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Error Isolation
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Error Isolation', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('catches handler errors without crashing', async () => {
        let secondCalled = false;
        bus.on('test', 'bad-plugin', () => { throw new Error('boom'); }, { priority: 1 });
        bus.on('test', 'good-plugin', () => { secondCalled = true; }, { priority: 2 });

        const delivered = await bus.emit('test', 'core', null);
        expect(secondCalled).toBe(true);
        // First failed, second succeeded
        expect(delivered).toBe(1);
    });

    it('tracks error count in stats', async () => {
        bus.on('fail', 'bad', () => { throw new Error('oops'); });

        await bus.emit('fail', 'core', null);
        await bus.emit('fail', 'core', null);

        const stats = bus.getStats();
        expect(stats.totalErrors).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Replay
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Replay', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus({ enableReplay: true }); });

    it('replays historical events', async () => {
        await bus.emit('log', 'core', { msg: 'first' });
        await bus.emit('log', 'core', { msg: 'second' });
        await bus.emit('other', 'core', { msg: 'ignored' });

        const replayed: PluginEvent[] = [];
        const count = await bus.replay('log', (e) => { replayed.push(e); });

        expect(count).toBe(2);
        expect(replayed).toHaveLength(2);
    });

    it('replays with limit', async () => {
        for (let i = 0; i < 10; i++) await bus.emit('log', 'core', i);

        const replayed: number[] = [];
        await bus.replay('log', (e) => { replayed.push(e.data as number); }, 3);

        expect(replayed).toEqual([7, 8, 9]);
    });

    it('throws when replay is disabled', async () => {
        const noReplay = new PluginEventBus({ enableReplay: false });
        await expect(noReplay.replay('test', () => {})).rejects.toThrow('disabled');
    });
});

// ═══════════════════════════════════════════════════════════════════
// History & Query
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — History', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus({ maxHistory: 5 }); });

    it('stores event history', async () => {
        await bus.emit('a', 'core', 1);
        await bus.emit('b', 'core', 2);

        const history = bus.getHistory();
        expect(history).toHaveLength(2);
    });

    it('caps history at maxHistory', async () => {
        for (let i = 0; i < 10; i++) await bus.emit('tick', 'core', i);

        const history = bus.getHistory();
        expect(history).toHaveLength(5);
        expect((history[0].data as number)).toBe(5); // oldest kept
    });

    it('filters history by type', async () => {
        await bus.emit('a', 'core', 1);
        await bus.emit('b', 'core', 2);
        await bus.emit('a', 'core', 3);

        expect(bus.getHistory({ type: 'a' })).toHaveLength(2);
        expect(bus.getHistory({ type: 'b' })).toHaveLength(1);
    });

    it('filters history by source', async () => {
        await bus.emit('x', 'plugin-a', 1);
        await bus.emit('x', 'plugin-b', 2);

        expect(bus.getHistory({ source: 'plugin-a' })).toHaveLength(1);
    });

    it('limits history results', async () => {
        for (let i = 0; i < 5; i++) await bus.emit('t', 'core', i);

        expect(bus.getHistory({ limit: 2 })).toHaveLength(2);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Stats', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('tracks emitted and delivered counts', async () => {
        bus.on('test', 'plugin', () => {});

        await bus.emit('test', 'core', null);
        await bus.emit('test', 'core', null);
        await bus.emit('other', 'core', null); // no subscriber

        const stats = bus.getStats();
        expect(stats.totalEmitted).toBe(3);
        expect(stats.totalDelivered).toBe(2);
    });

    it('tracks per-type stats', async () => {
        bus.on('alpha', 'plugin', () => {});
        bus.on('beta', 'plugin', () => {});

        await bus.emit('alpha', 'core', null);
        await bus.emit('alpha', 'core', null);
        await bus.emit('beta', 'core', null);

        const stats = bus.getStats();
        expect(stats.byType['alpha'].emitted).toBe(2);
        expect(stats.byType['beta'].emitted).toBe(1);
    });

    it('reports subscription count', () => {
        bus.on('a', 'p1', () => {});
        bus.on('a', 'p2', () => {});
        bus.on('b', 'p3', () => {});

        expect(bus.getSubscriptionCount()).toBe(3);
        expect(bus.getSubscriptionCount('a')).toBe(2);
        expect(bus.getSubscriptionCount('b')).toBe(1);
        expect(bus.getSubscriptionCount('c')).toBe(0);
    });

    it('reports event types', () => {
        bus.on('alpha', 'p1', () => {});
        bus.on('beta', 'p2', () => {});

        const types = bus.getEventTypes();
        expect(types).toContain('alpha');
        expect(types).toContain('beta');
    });

    it('reports plugin subscriptions', () => {
        bus.on('a', 'plugin-x', () => {});
        bus.on('b', 'plugin-x', () => {});
        bus.on('c', 'plugin-y', () => {});

        expect(bus.getPluginSubscriptions('plugin-x')).toHaveLength(2);
        expect(bus.getPluginSubscriptions('plugin-y')).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('PluginEventBus — Lifecycle', () => {
    let bus: PluginEventBus;

    beforeEach(() => { bus = new PluginEventBus(); });

    it('clear resets everything', async () => {
        bus.on('test', 'plugin', () => {});
        await bus.emit('test', 'core', null);

        bus.clear();

        expect(bus.getStats().totalEmitted).toBe(0);
        expect(bus.getSubscriptionCount()).toBe(0);
        expect(bus.getHistory()).toHaveLength(0);
    });

    it('emitSync fires without waiting', () => {
        let called = false;
        bus.on('sync', 'plugin', async () => {
            await new Promise(r => setTimeout(r, 5));
            called = true;
        });

        bus.emitSync('sync', 'core', null);
        // Not awaited — called may be false at this point, but no error
        expect(bus.getStats().totalEmitted).toBe(1);
    });
});
