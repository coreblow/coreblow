/**
 * CoreBlow — Key Rotation Manager Tests
 *
 * Tests for API key management: adding/removing keys, selection strategies
 * (round-robin, least-used, fastest, healthiest), success/failure reporting,
 * cooldown escalation, permanent error handling, scoring, and stats.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyRotationManager, type ApiKeyProfile } from './key-rotation.js';

function makeKey(id: string, provider = 'openai', priority = 0): ApiKeyProfile {
    return { id, key: `sk-${id}-fake-key`, provider, label: id, enabled: true, priority };
}

describe('KeyRotationManager', () => {
    let manager: KeyRotationManager;

    beforeEach(() => {
        manager = new KeyRotationManager({
            maxConsecutiveFailures: 3,
            cooldownMs: 5000,
            cooldownBackoffMultiplier: 2,
            maxCooldownMs: 60_000,
            strategy: 'healthiest',
            permanentErrors: ['invalid_api_key'],
        });
    });

    afterEach(() => {
        manager.stopAutoHeal();
    });

    // === Key Management ===

    describe('addKey / removeKey', () => {
        it('adds a key and makes it available', () => {
            manager.addKey(makeKey('k1'));
            const keys = manager.getAvailableKeys();
            expect(keys).toHaveLength(1);
            expect(keys[0]!.id).toBe('k1');
        });

        it('removes a key', () => {
            manager.addKey(makeKey('k1'));
            expect(manager.removeKey('k1')).toBe(true);
            expect(manager.getAvailableKeys()).toHaveLength(0);
        });

        it('returns false when removing non-existent key', () => {
            expect(manager.removeKey('ghost')).toBe(false);
        });
    });

    // === Key Selection ===

    describe('getKey', () => {
        it('returns the best available key', () => {
            manager.addKey(makeKey('k1'));
            const key = manager.getKey();
            expect(key?.id).toBe('k1');
        });

        it('returns null when no keys registered', () => {
            expect(manager.getKey()).toBeNull();
        });

        it('filters by provider', () => {
            manager.addKey(makeKey('k1', 'openai'));
            manager.addKey(makeKey('k2', 'anthropic'));

            const key = manager.getKey('anthropic');
            expect(key?.id).toBe('k2');
        });

        it('returns null when provider has no available keys', () => {
            manager.addKey(makeKey('k1', 'openai'));
            expect(manager.getKey('anthropic')).toBeNull();
        });
    });

    // === Selection Strategies ===

    describe('round-robin strategy', () => {
        it('cycles through keys', () => {
            const mgr = new KeyRotationManager({ strategy: 'round-robin' });
            mgr.addKey(makeKey('k1'));
            mgr.addKey(makeKey('k2'));
            mgr.addKey(makeKey('k3'));

            const ids = [mgr.getKey()?.id, mgr.getKey()?.id, mgr.getKey()?.id];
            expect(new Set(ids).size).toBeGreaterThan(1);
        });
    });

    describe('least-used strategy', () => {
        it('picks the key with fewest requests', () => {
            const mgr = new KeyRotationManager({ strategy: 'least-used' });
            mgr.addKey(makeKey('used'));
            mgr.addKey(makeKey('fresh'));

            // Simulate usage on 'used'
            mgr.reportSuccess('used', 100);
            mgr.reportSuccess('used', 100);

            expect(mgr.getKey()?.id).toBe('fresh');
        });
    });

    describe('fastest strategy', () => {
        it('picks the key with lowest average response time', () => {
            const mgr = new KeyRotationManager({ strategy: 'fastest' });
            mgr.addKey(makeKey('slow'));
            mgr.addKey(makeKey('fast'));

            mgr.reportSuccess('slow', 500);
            mgr.reportSuccess('fast', 50);

            expect(mgr.getKey()?.id).toBe('fast');
        });

        it('prefers untested keys (avgResponseTime = 0)', () => {
            const mgr = new KeyRotationManager({ strategy: 'fastest' });
            mgr.addKey(makeKey('tested'));
            mgr.addKey(makeKey('untested'));

            mgr.reportSuccess('tested', 100);

            expect(mgr.getKey()?.id).toBe('untested');
        });
    });

    // === Success / Failure ===

    describe('reportSuccess', () => {
        it('increments success count and resets consecutive failures', () => {
            manager.addKey(makeKey('k1'));
            manager.reportFailure('k1', 'timeout');
            manager.reportSuccess('k1', 100);

            const report = manager.getHealthReport();
            expect(report[0]!.health.successCount).toBe(1);
            expect(report[0]!.health.consecutiveFailures).toBe(0);
        });

        it('calculates exponential moving average for response time', () => {
            manager.addKey(makeKey('k1'));
            manager.reportSuccess('k1', 100);
            manager.reportSuccess('k1', 200);

            const report = manager.getHealthReport();
            // EMA: 100 first, then 100*0.8 + 200*0.2 = 120
            expect(report[0]!.health.avgResponseTime).toBeCloseTo(120, 0);
        });
    });

    describe('reportFailure', () => {
        it('increments failure count', () => {
            manager.addKey(makeKey('k1'));
            manager.reportFailure('k1', 'rate_limit');

            const report = manager.getHealthReport();
            expect(report[0]!.health.failureCount).toBe(1);
            expect(report[0]!.health.consecutiveFailures).toBe(1);
        });

        it('triggers cooldown after maxConsecutiveFailures', () => {
            manager.addKey(makeKey('k1'));
            manager.reportFailure('k1', 'err');
            manager.reportFailure('k1', 'err');
            manager.reportFailure('k1', 'err'); // 3rd — triggers cooldown

            const report = manager.getHealthReport();
            expect(report[0]!.health.cooldownUntil).toBeGreaterThan(Date.now());
        });

        it('puts key on cooldown so it becomes unavailable', () => {
            manager.addKey(makeKey('k1'));

            // Trigger cooldown
            for (let i = 0; i < 3; i++) manager.reportFailure('k1', 'err');

            expect(manager.getAvailableKeys()).toHaveLength(0);
        });
    });

    // === Permanent Errors ===

    describe('permanent errors', () => {
        it('permanently disables key on permanent error', () => {
            manager.addKey(makeKey('bad'));
            manager.reportFailure('bad', 'invalid_api_key');

            const keys = manager.getAvailableKeys();
            expect(keys).toHaveLength(0);
        });
    });

    // === Reset ===

    describe('resetKey', () => {
        it('resets health and re-enables a key', () => {
            manager.addKey(makeKey('k1'));
            for (let i = 0; i < 5; i++) manager.reportFailure('k1', 'err');

            expect(manager.resetKey('k1')).toBe(true);
            expect(manager.getAvailableKeys()).toHaveLength(1);
        });

        it('returns false for non-existent key', () => {
            expect(manager.resetKey('ghost')).toBe(false);
        });
    });

    // === Stats ===

    describe('getStats', () => {
        it('returns aggregate stats', () => {
            manager.addKey(makeKey('k1'));
            manager.addKey(makeKey('k2'));
            manager.reportSuccess('k1', 100);
            manager.reportFailure('k2', 'err');

            const stats = manager.getStats();
            expect(stats.totalKeys).toBe(2);
            expect(stats.enabledKeys).toBe(2);
            expect(stats.totalRequests).toBe(2);
            expect(stats.totalSuccess).toBe(1);
            expect(stats.totalFailures).toBe(1);
        });
    });

    // === Health Report ===

    describe('getHealthReport', () => {
        it('redacts API keys in output', () => {
            manager.addKey(makeKey('k1'));
            const report = manager.getHealthReport();
            expect(report[0]!.profile.key).toMatch(/^.{8}\.\.\.$/);
        });
    });
});
