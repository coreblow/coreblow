/**
 * plugins/hot-reload-manager.test.ts
 *
 * Comprehensive test suite for HotReloadManager and PluginHotReload.
 * Tests state management, reload policies, health checks, rollback,
 * dependency ordering, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    HotReloadManager,
    type ReloadAttempt,
    type PluginStateSnapshot,
    type HealthCheckResult,
} from './hot-reload-manager.js';
import { PluginHotReload, type ReloadResult } from './hot-reload.js';

// ─── Helpers ─────────────────────────────────────────────────────

function makeSnapshot(pluginId: string): PluginStateSnapshot {
    return {
        pluginId,
        config: { key: 'value' },
        version: '1.0.0',
        timestamp: Date.now(),
    };
}

function makeSuccessExecutor(): (pluginId: string) => Promise<ReloadResult> {
    return async (pluginId) => ({
        pluginId,
        success: true,
        duration: 10,
    });
}

function makeFailExecutor(errorMsg = 'reload error'): (pluginId: string) => Promise<ReloadResult> {
    return async (pluginId) => ({
        pluginId,
        success: false,
        duration: 5,
        error: errorMsg,
    });
}

// ─── Test Suite ──────────────────────────────────────────────────

describe('HotReloadManager', () => {
    let manager: HotReloadManager;

    beforeEach(() => {
        manager = new HotReloadManager();
    });

    // ════════════════════════════════════════════════════════════
    // Lifecycle (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('lifecycle', () => {
        it('should start in idle state', () => {
            expect(manager.getState()).toBe('idle');
        });

        it('should transition to active on start', () => {
            manager.start();
            expect(manager.getState()).toBe('active');
        });

        it('should transition to stopped on stop', () => {
            manager.start();
            manager.stop();
            expect(manager.getState()).toBe('stopped');
        });

        it('should have default immediate policy', () => {
            expect(manager.getPolicy()).toBe('immediate');
        });

        it('should accept custom config', () => {
            const m = new HotReloadManager({ policy: 'manual', maxRetries: 5 });
            expect(m.getPolicy()).toBe('manual');
        });
    });

    // ════════════════════════════════════════════════════════════
    // State Snapshots (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('state snapshots', () => {
        it('should save and retrieve snapshot', () => {
            const snap = makeSnapshot('plugin-a');
            manager.saveSnapshot(snap);
            expect(manager.getSnapshot('plugin-a')).toMatchObject({ pluginId: 'plugin-a' });
        });

        it('should return undefined for unknown plugin', () => {
            expect(manager.getSnapshot('unknown')).toBeUndefined();
        });

        it('should overwrite existing snapshot', () => {
            manager.saveSnapshot(makeSnapshot('plugin-a'));
            manager.saveSnapshot({ ...makeSnapshot('plugin-a'), version: '2.0.0' });
            expect(manager.getSnapshot('plugin-a')?.version).toBe('2.0.0');
        });

        it('should clear snapshot', () => {
            manager.saveSnapshot(makeSnapshot('plugin-a'));
            manager.clearSnapshot('plugin-a');
            expect(manager.getSnapshot('plugin-a')).toBeUndefined();
        });

        it('should track snapshot count', () => {
            manager.saveSnapshot(makeSnapshot('a'));
            manager.saveSnapshot(makeSnapshot('b'));
            expect(manager.getSnapshotCount()).toBe(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Immediate Reload Policy (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('immediate reload', () => {
        it('should execute reload immediately', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            const attempt = await manager.requestReload('plugin-a', 'test');
            expect(attempt).not.toBeNull();
            expect(attempt!.result).toBe('success');
        });

        it('should record successful attempt', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(manager.getAttempts()).toHaveLength(1);
            expect(manager.getAttempts()[0].result).toBe('success');
        });

        it('should record failed attempt', async () => {
            manager.setReloadExecutor(makeFailExecutor());
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('failed');
        });

        it('should increment fail count on failure', async () => {
            manager.setReloadExecutor(makeFailExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(manager.getFailCount('plugin-a')).toBe(1);
            await manager.requestReload('plugin-a');
            expect(manager.getFailCount('plugin-a')).toBe(2);
        });

        it('should clear fail count on success', async () => {
            manager.setReloadExecutor(makeFailExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(manager.getFailCount('plugin-a')).toBe(1);

            manager.setReloadExecutor(makeSuccessExecutor());
            await manager.requestReload('plugin-a');
            expect(manager.getFailCount('plugin-a')).toBe(0);
        });

        it('should fail without executor', async () => {
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('failed');
            expect(attempt!.error).toContain('No reload executor');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Manual Reload Policy (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('manual reload', () => {
        it('should queue reload instead of executing', async () => {
            const m = new HotReloadManager({ policy: 'manual' });
            m.setReloadExecutor(makeSuccessExecutor());
            m.start();
            const result = await m.requestReload('plugin-a');
            expect(result).toBeNull();
            expect(m.getQueueLength()).toBe(1);
        });

        it('should execute queued reloads on flush', async () => {
            const m = new HotReloadManager({ policy: 'manual' });
            m.setReloadExecutor(makeSuccessExecutor());
            m.start();
            await m.requestReload('plugin-a');
            await m.requestReload('plugin-b');
            const results = await m.flushQueue();
            expect(results).toHaveLength(2);
            expect(m.getQueueLength()).toBe(0);
        });

        it('should deduplicate queued reloads for same plugin', async () => {
            const m = new HotReloadManager({ policy: 'manual' });
            m.setReloadExecutor(makeSuccessExecutor());
            m.start();
            await m.requestReload('plugin-a', 'change-1');
            await m.requestReload('plugin-a', 'change-2');
            const results = await m.flushQueue();
            expect(results).toHaveLength(1);
        });

        it('should return empty on flush with no queue', async () => {
            const m = new HotReloadManager({ policy: 'manual' });
            const results = await m.flushQueue();
            expect(results).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Health Checks (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('health checks', () => {
        it('should pass reload when no health checker registered', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('success');
        });

        it('should pass when health check passes', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.registerHealthChecker('plugin-a', async () => ({
                pluginId: 'plugin-a',
                healthy: true,
                duration: 5,
                checks: [{ name: 'basic', passed: true }],
            }));
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('success');
            expect(attempt!.healthCheck?.healthy).toBe(true);
        });

        it('should fail when health check fails', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.registerHealthChecker('plugin-a', async () => ({
                pluginId: 'plugin-a',
                healthy: false,
                duration: 5,
                error: 'Service not responding',
                checks: [{ name: 'connectivity', passed: false }],
            }));
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).not.toBe('success');
        });

        it('should disable health checks via config', async () => {
            const m = new HotReloadManager({ healthCheckEnabled: false });
            m.setReloadExecutor(makeSuccessExecutor());
            m.registerHealthChecker('plugin-a', async () => ({
                pluginId: 'plugin-a', healthy: false, duration: 0,
                checks: [{ name: 'x', passed: false }],
            }));
            m.start();
            const attempt = await m.requestReload('plugin-a');
            expect(attempt!.result).toBe('success');
        });

        it('should track health check in attempt', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.registerHealthChecker('plugin-a', async () => ({
                pluginId: 'plugin-a',
                healthy: true,
                duration: 3,
                checks: [{ name: 'init', passed: true }, { name: 'hooks', passed: true }],
            }));
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.healthCheck?.checks).toHaveLength(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Rollback (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('rollback', () => {
        it('should attempt rollback when reload fails with snapshot', async () => {
            manager.setReloadExecutor(makeFailExecutor());
            manager.saveSnapshot(makeSnapshot('plugin-a'));
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('rolled-back');
        });

        it('should not rollback without snapshot', async () => {
            manager.setReloadExecutor(makeFailExecutor());
            manager.start();
            const attempt = await manager.requestReload('plugin-a');
            expect(attempt!.result).toBe('failed');
        });

        it('should not rollback when autoRollback disabled', async () => {
            const m = new HotReloadManager({ autoRollback: false });
            m.setReloadExecutor(makeFailExecutor());
            m.saveSnapshot(makeSnapshot('plugin-a'));
            m.start();
            const attempt = await m.requestReload('plugin-a');
            expect(attempt!.result).toBe('failed');
        });

        it('should emit rollback event', async () => {
            const events: string[] = [];
            manager.onEvent((e) => events.push(e.type));
            manager.setReloadExecutor(makeFailExecutor());
            manager.saveSnapshot(makeSnapshot('plugin-a'));
            manager.start();
            await manager.requestReload('plugin-a');
            expect(events).toContain('rollback');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Events (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('events', () => {
        it('should emit reload-start event', async () => {
            const events: string[] = [];
            manager.onEvent((e) => events.push(e.type));
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(events).toContain('reload-start');
        });

        it('should emit reload-success event', async () => {
            const events: string[] = [];
            manager.onEvent((e) => events.push(e.type));
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(events).toContain('reload-success');
        });

        it('should emit reload-failed event', async () => {
            const events: string[] = [];
            manager.onEvent((e) => events.push(e.type));
            manager.setReloadExecutor(makeFailExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(events).toContain('reload-failed');
        });

        it('should support unsubscribe', async () => {
            const events: string[] = [];
            const unsub = manager.onEvent((e) => events.push(e.type));
            unsub();
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            await manager.requestReload('plugin-a');
            expect(events).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Policy Changes (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('policy changes', () => {
        it('should change policy at runtime', () => {
            manager.setPolicy('batched');
            expect(manager.getPolicy()).toBe('batched');
        });

        it('should emit policy-change event', () => {
            const events: string[] = [];
            manager.onEvent((e) => events.push(e.type));
            manager.setPolicy('manual');
            expect(events).toContain('policy-change');
        });

        it('should switch behavior after policy change', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();

            // Start with immediate
            const result1 = await manager.requestReload('plugin-a');
            expect(result1).not.toBeNull();

            // Switch to manual
            manager.setPolicy('manual');
            const result2 = await manager.requestReload('plugin-b');
            expect(result2).toBeNull();
            expect(manager.getQueueLength()).toBe(1);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Stats & Health (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('stats and health', () => {
        it('should report initial stats', () => {
            const stats = manager.getStats();
            expect(stats.totalAttempts).toBe(0);
            expect(stats.successCount).toBe(0);
            expect(stats.failCount).toBe(0);
        });

        it('should track stats after reloads', async () => {
            manager.setReloadExecutor(makeSuccessExecutor());
            manager.start();
            await manager.requestReload('a');
            await manager.requestReload('b');

            const stats = manager.getStats();
            expect(stats.totalAttempts).toBe(2);
            expect(stats.successCount).toBe(2);
        });

        it('should report plugin as healthy when under max retries', () => {
            expect(manager.isHealthy('plugin-a')).toBe(true);
        });

        it('should report plugin as unhealthy after too many failures', async () => {
            const m = new HotReloadManager({ maxRetries: 2 });
            m.setReloadExecutor(makeFailExecutor());
            m.start();
            await m.requestReload('plugin-a');
            await m.requestReload('plugin-a');
            expect(m.isHealthy('plugin-a')).toBe(false);
        });
    });
});

// ─── PluginHotReload Unit Tests ──────────────────────────────────

describe('PluginHotReload', () => {
    let hotReload: PluginHotReload;

    beforeEach(() => {
        hotReload = new PluginHotReload({
            watchPaths: [],
            autoReload: false,
        });
    });

    describe('lifecycle', () => {
        it('should start in idle state', () => {
            expect(hotReload.getState()).toBe('idle');
        });

        it('should track registered plugins', () => {
            hotReload.registerPlugin('test-plugin', '/fake/path');
            const registered = hotReload.getRegisteredPlugins();
            expect(registered.size).toBe(1);
        });

        it('should return empty reload history initially', () => {
            expect(hotReload.getReloadHistory()).toHaveLength(0);
        });

        it('should return 100% success rate with no history', () => {
            expect(hotReload.getSuccessRate()).toBe(1);
        });

        it('should return 0 reload count initially', () => {
            expect(hotReload.getReloadCount()).toBe(0);
        });
    });

    describe('manual trigger', () => {
        it('should fail trigger without handler', async () => {
            const result = await hotReload.triggerReload('test-plugin');
            expect(result.success).toBe(false);
            expect(result.error).toContain('No reload handler');
        });

        it('should execute handler on trigger', async () => {
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 10,
            }));
            const result = await hotReload.triggerReload('test-plugin');
            expect(result.success).toBe(true);
        });

        it('should record trigger in history', async () => {
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 5,
            }));
            await hotReload.triggerReload('test-plugin');
            expect(hotReload.getReloadHistory()).toHaveLength(1);
        });

        it('should mark trigger event type as manual', async () => {
            let capturedEvent: unknown;
            hotReload.onReload(async (event) => {
                capturedEvent = event;
                return { pluginId: event.pluginId, success: true, duration: 0 };
            });
            await hotReload.triggerReload('test-plugin');
            expect((capturedEvent as { type: string }).type).toBe('manual');
        });
    });

    describe('event listeners', () => {
        it('should support event listeners', () => {
            const events: string[] = [];
            hotReload.on((event) => events.push(event));
            // The listener should be registered (no crash)
            expect(events).toHaveLength(0);
        });

        it('should return unsubscribe function', () => {
            const unsub = hotReload.on(() => {});
            expect(typeof unsub).toBe('function');
            unsub(); // Should not throw
        });
    });
});
