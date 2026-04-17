/**
 * Phase 29: System Operations Test Suite
 *
 * Covers: MetricsCollector, HealthAggregator, ResponseCompression
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from './collector.js';
import { HealthAggregator } from './health.js';
import { ResponseCompression } from './response-compression.js';

describe('System Operations Suite', () => {

    // ═══════════════════════════════════════
    // MetricsCollector
    // ═══════════════════════════════════════
    describe('MetricsCollector', () => {
        let mc: MetricsCollector;
        beforeEach(() => { mc = new MetricsCollector(100); });

        it('records events and increments counters', () => {
            mc.record('request', { path: '/api' });
            mc.record('request', { path: '/health' });
            mc.record('error', { code: 500 });

            expect(mc.getCount('request')).toBe(2);
            expect(mc.getCount('error')).toBe(1);
        });

        it('retrieves events filtered by type', () => {
            mc.record('login', { user: 'alice' });
            mc.record('logout', { user: 'bob' });
            mc.record('login', { user: 'charlie' });

            const logins = mc.getEvents('login');
            expect(logins).toHaveLength(2);
            expect(logins[0].data!.user).toBe('alice');
        });

        it('increments counters independently', () => {
            mc.increment('api_calls', 5);
            mc.increment('api_calls', 3);
            mc.increment('errors');

            expect(mc.getCount('api_calls')).toBe(8);
            expect(mc.getCount('errors')).toBe(1);
        });

        it('resets all data', () => {
            mc.record('x', {});
            mc.increment('y', 10);
            mc.reset();

            expect(mc.getCount('x')).toBe(0);
            expect(mc.getCount('y')).toBe(0);
            expect(mc.getEvents()).toHaveLength(0);
        });

        it('caps events at maxEvents', () => {
            const small = new MetricsCollector(5);
            for (let i = 0; i < 10; i++) small.record('ev', { i });

            expect(small.getEvents().length).toBeLessThanOrEqual(5);
            expect(small.getCount('ev')).toBe(10); // counter still accurate
        });
    });

    // ═══════════════════════════════════════
    // HealthAggregator
    // ═══════════════════════════════════════
    describe('HealthAggregator', () => {
        let ha: HealthAggregator;
        beforeEach(() => { ha = new HealthAggregator('2.0.0'); });

        it('reports healthy when all components pass', async () => {
            ha.register('db', async () => ({ name: 'db', status: 'healthy', lastCheckedAt: Date.now() }));
            ha.register('cache', async () => ({ name: 'cache', status: 'healthy', lastCheckedAt: Date.now() }));

            const health = await ha.check();
            expect(health.status).toBe('healthy');
            expect(health.components).toHaveLength(2);
            expect(health.version).toBe('2.0.0');
            expect(health.memory.rss).toBeGreaterThan(0);
        });

        it('reports degraded when any component is degraded', async () => {
            ha.register('api', async () => ({ name: 'api', status: 'healthy', lastCheckedAt: Date.now() }));
            ha.register('cache', async () => ({ name: 'cache', status: 'degraded', message: 'high latency', lastCheckedAt: Date.now() }));

            const health = await ha.check();
            expect(health.status).toBe('degraded');
        });

        it('reports unhealthy when any component fails', async () => {
            ha.register('db', async () => ({ name: 'db', status: 'unhealthy', message: 'connection refused', lastCheckedAt: Date.now() }));
            ha.register('api', async () => ({ name: 'api', status: 'healthy', lastCheckedAt: Date.now() }));

            const health = await ha.check();
            expect(health.status).toBe('unhealthy');
        });

        it('handles check function that throws', async () => {
            ha.register('broken', async () => { throw new Error('crash'); });

            const health = await ha.check();
            expect(health.status).toBe('unhealthy');
            expect(health.components[0].message).toBe('crash');
        });

        it('ping returns quick status', async () => {
            ha.register('ok', async () => ({ name: 'ok', status: 'healthy', lastCheckedAt: Date.now() }));

            const ping = await ha.ping();
            expect(ping.status).toBe('healthy');
            expect(ping.uptime).toBeGreaterThan(0);
        });

        it('reports unknown status when no components registered', async () => {
            const health = await ha.check();
            expect(health.status).toBe('unknown');
            expect(health.components).toHaveLength(0);
        });

        it('registerDefaults adds memory and event-loop checks', async () => {
            ha.registerDefaults();
            const health = await ha.check();
            expect(health.components.length).toBeGreaterThanOrEqual(2);

            const names = health.components.map(c => c.name);
            expect(names).toContain('memory');
            expect(names).toContain('event-loop');
        });
    });

    // ═══════════════════════════════════════
    // ResponseCompression
    // ═══════════════════════════════════════
    describe('ResponseCompression', () => {
        let rc: ResponseCompression;
        beforeEach(() => { rc = new ResponseCompression(); });

        it('compresses JSON above minimum size', () => {
            const bigJson = JSON.stringify({ data: 'x'.repeat(2000) });
            const result = rc.compress(bigJson, 'application/json');

            expect(result.skipped).toBe(false);
            expect(result.algorithm).toBe('gzip');
            expect(result.compressed).toBeLessThan(result.original);
            expect(result.ratio).toBeLessThan(1);
        });

        it('skips compression below minimum size', () => {
            const result = rc.compress('hi', 'application/json');
            expect(result.skipped).toBe(true);
            expect(result.algorithm).toBe('none');
        });

        it('skips non-compressible content types', () => {
            const data = 'x'.repeat(2000);
            const result = rc.compress(data, 'image/png');
            expect(result.skipped).toBe(true);
        });

        it('negotiates algorithm from Accept-Encoding', () => {
            expect(rc.negotiate('gzip, deflate, br')).toBe('br');
            expect(rc.negotiate('gzip, deflate')).toBe('gzip');
            expect(rc.negotiate('deflate')).toBe('deflate');
            expect(rc.negotiate('')).toBe('none');
        });

        it('tracks compression statistics', () => {
            const large = 'x'.repeat(2000);
            rc.compress(large, 'application/json');
            rc.compress(large, 'text/html');
            rc.compress('small', 'text/html'); // skipped

            const stats = rc.getStats();
            expect(stats.compressed).toBe(2);
            expect(stats.skipped).toBe(1);
            expect(stats.bytesSaved).toBeGreaterThan(0);
            expect(stats.compressionRate).toBeCloseTo(2 / 3, 1);
        });

        it('allows adding custom compressible types', () => {
            rc.addType('application/xml');
            expect(rc.shouldCompress('application/xml', 2000)).toBe(true);
        });
    });
});
