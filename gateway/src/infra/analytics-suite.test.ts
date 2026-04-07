// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventTracker, EventSink } from './event-tracker.js';
import { MetricAggregator } from './metric-aggregator.js';
import { PerformanceMonitor } from './performance-monitor.js';

describe('Analytics & Metrics Suite', () => {

    describe('EventTracker', () => {
        let sink: EventSink;
        let flushSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            flushSpy = vi.fn();
            sink = { flush: flushSpy };
        });

        it('buffers events and manually flushes', () => {
            const tracker = new EventTracker({ sink });
            tracker.track('login', { user: 'u1' });
            tracker.track('click', { btn: 'purchase' });

            expect(tracker.getStats().buffered).toBe(2);
            expect(flushSpy).not.toHaveBeenCalled();

            tracker.flush();

            expect(tracker.getStats().buffered).toBe(0);
            expect(tracker.getStats().flushes).toBe(1);
            expect(flushSpy).toHaveBeenCalledTimes(1);

            const flushedEvents = flushSpy.mock.calls[0][0];
            expect(flushedEvents).toHaveLength(2);
            expect(flushedEvents[0].name).toBe('login');
            expect(flushedEvents[1].name).toBe('click');
        });

        it('auto-flushes when maxBufferSize is reached', () => {
            const tracker = new EventTracker({ maxBufferSize: 3, sink });

            tracker.track('ev1', {});
            tracker.track('ev2', {});
            expect(flushSpy).not.toHaveBeenCalled();

            tracker.track('ev3', {}); // triggers flush
            expect(flushSpy).toHaveBeenCalledTimes(1);
            expect(tracker.getStats().buffered).toBe(0); // cleared

            tracker.track('ev4', {}); // anew
            expect(tracker.getStats().buffered).toBe(1);
        });

        it('swallows errors from faulty sink to prevent crashing', () => {
            const faultySink = {
                flush: () => { throw new Error('Network error'); }
            };
            const tracker = new EventTracker({ sink: faultySink });

            // Should not throw
            expect(() => {
                tracker.track('err_test', {});
                tracker.flush();
            }).not.toThrow();
        });
    });

    describe('MetricAggregator', () => {
        it('tracks and aggregates counters', () => {
            const agg = new MetricAggregator();
            agg.increment('requests');
            agg.increment('requests', 5);
            agg.decrement('requests', 2);

            expect(agg.getCounter('requests')).toBe(4); // 1 + 5 - 2
            expect(agg.getCounter('nonexistent')).toBe(0);
        });

        it('tracks gauges', () => {
            const agg = new MetricAggregator();
            agg.setGauge('cpu_usage', 50);
            agg.setGauge('cpu_usage', 85);

            expect(agg.getGauge('cpu_usage')).toBe(85);
            expect(agg.getGauge('nonexistent')).toBe(0);
        });

        it('generates a full snapshot', () => {
            const agg = new MetricAggregator();
            agg.increment('errors', 3);
            agg.setGauge('mem', 1024);

            const snap = agg.getSnapshot();
            expect(snap.counters['errors']).toBe(3);
            expect(snap.gauges['mem']).toBe(1024);
        });

        it('can clear metrics safely', () => {
            const agg = new MetricAggregator();
            agg.increment('x');
            agg.clear();
            expect(agg.getCounter('x')).toBe(0);
        });
    });

    describe('PerformanceMonitor', () => {
        it('monitors synchronous functions', () => {
            const monitor = new PerformanceMonitor();
            const result = monitor.monitorSync('sync_op', () => {
                // busy wait
                let i = 0; while (i < 1000000) i++;
                return 'done';
            });

            expect(result).toBe('done');
            
            const stats = monitor.getStats('sync_op');
            expect(stats).not.toBeNull();
            expect(stats!.count).toBe(1);
            expect(stats!.meanMs).toBeGreaterThanOrEqual(0);
        });

        it('monitors asynchronous functions', async () => {
            const monitor = new PerformanceMonitor();
            const result = await monitor.monitorAsync('async_op', async () => {
                await new Promise(r => setTimeout(r, 10));
                return 42;
            });

            expect(result).toBe(42);

            const stats = monitor.getStats('async_op');
            expect(stats!.count).toBe(1);
            expect(stats!.totalMs).toBeGreaterThanOrEqual(9); // Some epsilon
        });

        it('aggregates statistics across multiple calls', () => {
            const monitor = new PerformanceMonitor();
            const stop1 = monitor.startTimer('task');
            stop1();
            const stop2 = monitor.startTimer('task');
            stop2();

            const stats = monitor.getStats('task');
            expect(stats!.count).toBe(2);
            expect(stats!.minMs).toBeLessThanOrEqual(stats!.maxMs);
        });

        it('capped at 10,000 records to prevent memory leaks', () => {
            const monitor = new PerformanceMonitor();
            for (let i = 0; i < 10005; i++) {
                const stop = monitor.startTimer('hot_path');
                stop();
            }

            const stats = monitor.getStats('hot_path');
            expect(stats!.count).toBe(10000);
        });
    });
});
