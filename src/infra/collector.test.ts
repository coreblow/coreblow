import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from './collector.js';

describe('MetricsCollector', () => {
    let collector: MetricsCollector;

    beforeEach(() => {
        collector = new MetricsCollector(100);
    });

    describe('record', () => {
        it('records an event', () => {
            collector.record('request', { path: '/api' });
            const events = collector.getEvents();
            expect(events).toHaveLength(1);
            expect(events[0]?.type).toBe('request');
            expect(events[0]?.data).toEqual({ path: '/api' });
        });

        it('auto-increments counter for type', () => {
            collector.record('request');
            collector.record('request');
            expect(collector.getCount('request')).toBe(2);
        });

        it('caps events at maxEvents', () => {
            const small = new MetricsCollector(5);
            for (let i = 0; i < 10; i++) small.record('evt');
            expect(small.getEvents().length).toBeLessThanOrEqual(5);
        });
    });

    describe('increment', () => {
        it('increments a counter', () => {
            collector.increment('errors');
            collector.increment('errors');
            collector.increment('errors', 3);
            expect(collector.getCount('errors')).toBe(5);
        });

        it('defaults to +1', () => {
            collector.increment('x');
            expect(collector.getCount('x')).toBe(1);
        });
    });

    describe('getCount', () => {
        it('returns 0 for unknown metric', () => {
            expect(collector.getCount('ghost')).toBe(0);
        });
    });

    describe('getEvents', () => {
        it('filters by type', () => {
            collector.record('a');
            collector.record('b');
            collector.record('a');
            expect(collector.getEvents('a')).toHaveLength(2);
        });

        it('respects limit', () => {
            for (let i = 0; i < 20; i++) collector.record('evt');
            expect(collector.getEvents(undefined, 5)).toHaveLength(5);
        });

        it('returns latest events', () => {
            collector.record('first', { id: 1 });
            collector.record('second', { id: 2 });
            const events = collector.getEvents(undefined, 1);
            expect(events[0]?.type).toBe('second');
        });
    });

    describe('reset', () => {
        it('clears events and counters', () => {
            collector.record('x');
            collector.increment('y');
            collector.reset();
            expect(collector.getEvents()).toHaveLength(0);
            expect(collector.getCount('x')).toBe(0);
            expect(collector.getCount('y')).toBe(0);
        });
    });
});
