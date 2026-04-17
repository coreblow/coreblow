/**
 * tests/unit/key-rotation.test.ts
 * API Key Rotation tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Key Rotation Manager', () => {
    let KeyRotationManager: any;

    beforeEach(async () => {
        const mod = await import('../../src/providers/key-rotation.js');
        KeyRotationManager = mod.KeyRotationManager;
    });

    function makeKey(id: string, provider = 'openai', priority = 0) {
        return { id, key: `sk-test-${id}`, provider, label: `Key ${id}`, enabled: true, priority };
    }

    // ── Basic Operations ──

    it('should add and retrieve keys', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        expect(mgr.getStats().totalKeys).toBe(2);
    });

    it('should remove keys', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        expect(mgr.removeKey('a')).toBe(true);
        expect(mgr.getStats().totalKeys).toBe(0);
    });

    it('should get available key', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        const key = mgr.getKey();
        expect(key).not.toBeNull();
        expect(key!.id).toBe('a');
    });

    it('should return null when no keys available', () => {
        const mgr = new KeyRotationManager();
        expect(mgr.getKey()).toBeNull();
    });

    it('should filter by provider', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a', 'openai'));
        mgr.addKey(makeKey('b', 'anthropic'));
        const key = mgr.getKey('anthropic');
        expect(key!.id).toBe('b');
    });

    // ── Success/Failure Tracking ──

    it('should track success', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportSuccess('a', 200);
        mgr.reportSuccess('a', 300);
        const stats = mgr.getStats();
        expect(stats.totalRequests).toBe(2);
        expect(stats.totalSuccess).toBe(2);
    });

    it('should track failure', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportFailure('a', 'rate_limit');
        const stats = mgr.getStats();
        expect(stats.totalFailures).toBe(1);
    });

    // ── Cooldown ──

    it('should put key on cooldown after max failures', () => {
        const mgr = new KeyRotationManager({ maxConsecutiveFailures: 2 });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportFailure('a', 'error');
        mgr.reportFailure('a', 'error');
        // Key 'a' should now be on cooldown
        const available = mgr.getAvailableKeys();
        expect(available.find((k: any) => k.id === 'a')).toBeUndefined();
        expect(available.find((k: any) => k.id === 'b')).toBeDefined();
    });

    it('should auto-rotate to next key on cooldown', () => {
        const mgr = new KeyRotationManager({ maxConsecutiveFailures: 1 });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportFailure('a', 'error');
        const key = mgr.getKey();
        expect(key!.id).toBe('b');
    });

    it('should reset cooldown on success', () => {
        const mgr = new KeyRotationManager({ maxConsecutiveFailures: 2 });
        mgr.addKey(makeKey('a'));
        mgr.reportFailure('a', 'error');
        mgr.reportSuccess('a', 100);
        // Consecutive failures reset
        mgr.reportFailure('a', 'error');
        // Still available (only 1 failure after reset)
        expect(mgr.getAvailableKeys()).toHaveLength(1);
    });

    // ── Permanent Errors ──

    it('should disable key on permanent error', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportFailure('a', 'invalid_api_key');
        expect(mgr.getStats().enabledKeys).toBe(0);
    });

    it('should not disable on transient errors', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportFailure('a', 'rate_limit_exceeded');
        expect(mgr.getStats().enabledKeys).toBe(1);
    });

    // ── Strategies ──

    it('should round-robin between keys', () => {
        const mgr = new KeyRotationManager({ strategy: 'round-robin' });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.addKey(makeKey('c'));

        const picks = [mgr.getKey()!.id, mgr.getKey()!.id, mgr.getKey()!.id];
        expect(new Set(picks).size).toBe(3);
    });

    it('should pick least-used key', () => {
        const mgr = new KeyRotationManager({ strategy: 'least-used' });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportSuccess('a', 100);
        mgr.reportSuccess('a', 100);
        const key = mgr.getKey();
        expect(key!.id).toBe('b'); // 0 requests vs 2
    });

    it('should pick fastest key', () => {
        const mgr = new KeyRotationManager({ strategy: 'fastest' });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportSuccess('a', 500);
        mgr.reportSuccess('b', 100);
        const key = mgr.getKey();
        expect(key!.id).toBe('b'); // 100ms vs 500ms
    });

    it('should pick healthiest key', () => {
        const mgr = new KeyRotationManager({ strategy: 'healthiest' });
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportSuccess('a', 100);
        mgr.reportFailure('b', 'error');
        mgr.reportFailure('b', 'error');
        const key = mgr.getKey();
        expect(key!.id).toBe('a');
    });

    // ── Health Report ──

    it('should generate health report', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportSuccess('a', 200);
        const report = mgr.getHealthReport();
        expect(report).toHaveLength(1);
        expect(report[0].health.successCount).toBe(1);
        expect(report[0].profile.key).toContain('...'); // redacted
    });

    it('should track average response time', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.reportSuccess('a', 100);
        mgr.reportSuccess('a', 300);
        const report = mgr.getHealthReport();
        expect(report[0].health.avgResponseTime).toBeGreaterThan(0);
    });

    // ── Reset ──

    it('should force reset a key', () => {
        const mgr = new KeyRotationManager({ maxConsecutiveFailures: 1 });
        mgr.addKey(makeKey('a'));
        mgr.reportFailure('a', 'invalid_api_key'); // permanently disabled
        expect(mgr.getStats().enabledKeys).toBe(0);

        mgr.resetKey('a');
        expect(mgr.getStats().enabledKeys).toBe(1);
        expect(mgr.getAvailableKeys()).toHaveLength(1);
    });

    // ── Stats ──

    it('should get comprehensive stats', () => {
        const mgr = new KeyRotationManager();
        mgr.addKey(makeKey('a'));
        mgr.addKey(makeKey('b'));
        mgr.reportSuccess('a', 100);
        mgr.reportFailure('b', 'error');

        const stats = mgr.getStats();
        expect(stats.totalKeys).toBe(2);
        expect(stats.enabledKeys).toBe(2);
        expect(stats.totalRequests).toBe(2);
        expect(stats.totalSuccess).toBe(1);
        expect(stats.totalFailures).toBe(1);
    });
});
