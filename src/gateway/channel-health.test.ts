/**
 * CoreBlow — Channel Health Monitor Tests
 *
 * Tests for channel registration, heartbeat/error recording,
 * status transitions, event emission, health summary, and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChannelHealthMonitor } from './channel-health.js';

describe('ChannelHealthMonitor', () => {
    let monitor: ChannelHealthMonitor;

    beforeEach(() => {
        monitor = new ChannelHealthMonitor({ maxConsecutiveErrors: 3 });
    });

    afterEach(() => {
        monitor.clear();
    });

    // === Registration ===

    describe('register', () => {
        it('registers a channel with unknown status', () => {
            monitor.register('slack');
            const status = monitor.getStatus('slack');
            expect(status?.channelId).toBe('slack');
            expect(status?.status).toBe('unknown');
            expect(status?.errorCount).toBe(0);
        });

        it('stores metadata', () => {
            monitor.register('discord', { region: 'us-east' });
            expect(monitor.getStatus('discord')?.metadata).toEqual({ region: 'us-east' });
        });
    });

    // === Heartbeat ===

    describe('recordHeartbeat', () => {
        it('sets status to connected', () => {
            monitor.register('ch1');
            monitor.recordHeartbeat('ch1', 50);
            const status = monitor.getStatus('ch1');
            expect(status?.status).toBe('connected');
            expect(status?.latencyMs).toBe(50);
            expect(status?.successCount).toBe(1);
        });

        it('tracks lastHeartbeat timestamp', () => {
            monitor.register('ch1');
            const before = Date.now();
            monitor.recordHeartbeat('ch1');
            expect(monitor.getStatus('ch1')?.lastHeartbeat).toBeGreaterThanOrEqual(before);
        });

        it('resets error count on recovery', () => {
            monitor.register('ch1');
            monitor.recordError('ch1', 'err1');
            monitor.recordError('ch1', 'err2');
            monitor.recordHeartbeat('ch1');
            expect(monitor.getStatus('ch1')?.errorCount).toBe(0);
        });

        it('emits recovered event', () => {
            monitor.register('ch1');
            let recovered = false;
            monitor.on('recovered', () => { recovered = true; });
            monitor.recordHeartbeat('ch1');
            expect(recovered).toBe(true);
        });

        it('ignores unknown channels', () => {
            monitor.recordHeartbeat('ghost'); // should not throw
        });
    });

    // === Error Recording ===

    describe('recordError', () => {
        it('increments error count', () => {
            monitor.register('ch1');
            monitor.recordError('ch1', 'timeout');
            expect(monitor.getStatus('ch1')?.errorCount).toBe(1);
            expect(monitor.getStatus('ch1')?.lastError).toBe('timeout');
        });

        it('sets degraded after first error', () => {
            monitor.register('ch1');
            monitor.recordError('ch1', 'err');
            expect(monitor.getStatus('ch1')?.status).toBe('degraded');
        });

        it('sets disconnected after maxConsecutiveErrors', () => {
            monitor.register('ch1');
            monitor.recordError('ch1', 'err1');
            monitor.recordError('ch1', 'err2');
            monitor.recordError('ch1', 'err3'); // 3rd error = disconnected
            expect(monitor.getStatus('ch1')?.status).toBe('disconnected');
        });

        it('emits degraded event', () => {
            monitor.register('ch1');
            let degraded = false;
            monitor.on('degraded', () => { degraded = true; });
            monitor.recordError('ch1', 'err');
            expect(degraded).toBe(true);
        });

        it('emits disconnected event', () => {
            monitor.register('ch1');
            let disconnected = false;
            monitor.on('disconnected', (data) => {
                disconnected = true;
                expect(data.errorCount).toBe(3);
            });
            for (let i = 0; i < 3; i++) monitor.recordError('ch1', 'err');
            expect(disconnected).toBe(true);
        });
    });

    // === Health Summary ===

    describe('getHealthySummary', () => {
        it('returns aggregate counts', () => {
            monitor.register('healthy');
            monitor.register('degraded');
            monitor.register('disconnected');

            monitor.recordHeartbeat('healthy');
            monitor.recordError('degraded', 'err');
            for (let i = 0; i < 3; i++) monitor.recordError('disconnected', 'err');

            const summary = monitor.getHealthySummary();
            expect(summary.total).toBe(3);
            expect(summary.healthy).toBe(1);
            expect(summary.degraded).toBe(1);
            expect(summary.disconnected).toBe(1);
        });

        it('returns zeros when empty', () => {
            const summary = monitor.getHealthySummary();
            expect(summary).toEqual({ total: 0, healthy: 0, degraded: 0, disconnected: 0 });
        });
    });

    // === Listing ===

    describe('getAllStatuses', () => {
        it('returns all channel states', () => {
            monitor.register('a');
            monitor.register('b');
            expect(monitor.getAllStatuses()).toHaveLength(2);
        });
    });

    // === Cleanup ===

    describe('remove', () => {
        it('removes a channel', () => {
            monitor.register('doomed');
            monitor.remove('doomed');
            expect(monitor.getStatus('doomed')).toBeUndefined();
        });
    });

    describe('clear', () => {
        it('removes all channels', () => {
            monitor.register('a');
            monitor.register('b');
            monitor.clear();
            expect(monitor.getAllStatuses()).toHaveLength(0);
        });
    });
});
