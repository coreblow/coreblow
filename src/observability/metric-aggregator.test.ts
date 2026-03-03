import { describe, it, expect, beforeEach } from 'vitest';
import { MetricAggregator } from './metric-aggregator.js';

describe('MetricAggregator', () => {
    let aggregator: MetricAggregator;

    beforeEach(() => {
        aggregator = new MetricAggregator();
    });

    // === Recording ===

    describe('record', () => {
        it('stores a metric point', () => {
            aggregator.record('cpu', 42);
            expect(aggregator.count()).toBe(1);
        });

        it('stores multiple points', () => {
            aggregator.record('cpu', 42);
            aggregator.record('cpu', 55);
            aggregator.record('memory', 80);
            expect(aggregator.count()).toBe(3);
        });
    });

    // === Aggregation ===

    describe('aggregate', () => {
        it('returns zeros for empty metrics', () => {
            const result = aggregator.aggregate('empty', 60_000);
            expect(result.count).toBe(0);
            expect(result.sum).toBe(0);
            expect(result.min).toBe(0);
            expect(result.max).toBe(0);
        });

        it('computes min/max/avg/sum correctly', () => {
            aggregator.record('latency', 100);
            aggregator.record('latency', 200);
            aggregator.record('latency', 300);

            const result = aggregator.aggregate('latency', 60_000);
            expect(result.count).toBe(3);
            expect(result.min).toBe(100);
            expect(result.max).toBe(300);
            expect(result.avg).toBe(200);
            expect(result.sum).toBe(600);
        });

        it('computes p95 and p99 percentiles', () => {
            // Record 100 points from 1 to 100
            for (let i = 1; i <= 100; i++) {
                aggregator.record('p', i);
            }

            const result = aggregator.aggregate('p', 60_000);
            expect(result.p95).toBe(96); // floor(100 * 0.95) = position 95 → value 96
            expect(result.p99).toBe(100); // floor(100 * 0.99) = position 99 → value 100
        });

        it('only aggregates within the time window', () => {
            aggregator.record('old', 999);
            // The record uses Date.now(), so a very short window should still include it
            const result = aggregator.aggregate('old', 1000);
            expect(result.count).toBe(1);
        });

        it('only aggregates the named metric', () => {
            aggregator.record('cpu', 50);
            aggregator.record('memory', 80);

            const cpu = aggregator.aggregate('cpu', 60_000);
            expect(cpu.count).toBe(1);
            expect(cpu.avg).toBe(50);
        });
    });

    // === Rate ===

    describe('rate', () => {
        it('computes points per second', () => {
            for (let i = 0; i < 10; i++) aggregator.record('requests', 1);

            const rate = aggregator.rate('requests', 1000); // 10 points in 1s = 10/s
            expect(rate).toBe(10);
        });

        it('returns 0 for no data', () => {
            expect(aggregator.rate('empty', 1000)).toBe(0);
        });
    });

    // === Listing ===

    describe('listMetrics', () => {
        it('returns unique metric names', () => {
            aggregator.record('cpu', 1);
            aggregator.record('cpu', 2);
            aggregator.record('memory', 3);

            const names = aggregator.listMetrics();
            expect(names).toEqual(expect.arrayContaining(['cpu', 'memory']));
            expect(names).toHaveLength(2);
        });

        it('returns empty array when no metrics', () => {
            expect(aggregator.listMetrics()).toEqual([]);
        });
    });

    // === Tag Filtering ===

    describe('filterByTag', () => {
        it('filters points by tag key/value', () => {
            aggregator.record('latency', 100, { region: 'us-east' });
            aggregator.record('latency', 200, { region: 'eu-west' });
            aggregator.record('latency', 150, { region: 'us-east' });

            const usEast = aggregator.filterByTag('latency', 'region', 'us-east');
            expect(usEast).toHaveLength(2);
            expect(usEast.every((p) => p.tags?.['region'] === 'us-east')).toBe(true);
        });

        it('returns empty for non-matching tags', () => {
            aggregator.record('latency', 100, { region: 'us-east' });
            expect(aggregator.filterByTag('latency', 'region', 'asia')).toHaveLength(0);
        });
    });

    // === Clear ===

    describe('clear', () => {
        it('removes all points', () => {
            aggregator.record('x', 1);
            aggregator.record('y', 2);
            aggregator.clear();
            expect(aggregator.count()).toBe(0);
        });
    });
});
