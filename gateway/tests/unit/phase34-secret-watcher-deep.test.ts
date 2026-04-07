/**
 * CoreBlow Phase 34 — SecretWatcher Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Registration, get, rotation, masking, leak detection
 *   - Expiry checks, alerts, deletion
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SecretWatcher } from '../../src/config/secret-watcher.js';

describe('SecretWatcher — Extended', () => {
    let watcher: SecretWatcher;
    beforeEach(() => {
        watcher = new SecretWatcher();
        watcher.register('openai', 'sk-abc123xyz789', 'openai');
        watcher.register('anthropic', 'ant-key-456def', 'anthropic');
    });

    it('should register and retrieve secrets', () => {
        expect(watcher.get('openai')).toBe('sk-abc123xyz789');
        expect(watcher.get('anthropic')).toBe('ant-key-456def');
    });

    it('should return null for unregistered secret', () => {
        expect(watcher.get('ghost')).toBeNull();
    });

    it('should mask secret values (show last 4 chars)', () => {
        expect(watcher.getMasked('openai')).toBe('****z789');
        expect(watcher.getMasked('anthropic')).toBe('****6def');
    });

    it('should fully mask short secrets', () => {
        watcher.register('short', 'ab');
        expect(watcher.getMasked('short')).toBe('****');
    });

    it('should rotate secrets and increment count', () => {
        expect(watcher.rotate('openai', 'sk-new-key-999')).toBe(true);
        expect(watcher.get('openai')).toBe('sk-new-key-999');

        // Rotate again
        watcher.rotate('openai', 'sk-newest-key');
        const list = watcher.list();
        const openai = list.find(s => s.key === 'openai');
        expect(openai?.rotationCount).toBe(2);
    });

    it('should return false when rotating non-existent secret', () => {
        expect(watcher.rotate('ghost', 'new-value')).toBe(false);
    });

    it('should detect leaked secrets in text', () => {
        const text = 'Please use the key sk-abc123xyz789 for access';
        const leaks = watcher.scanForLeaks(text);
        expect(leaks).toHaveLength(1);
        expect(leaks[0]?.type).toBe('leaked');
        expect(leaks[0]?.key).toBe('openai');
    });

    it('should not detect leaks for clean text', () => {
        const text = 'This is a clean message with no secrets';
        expect(watcher.scanForLeaks(text)).toHaveLength(0);
    });

    it('should return null for expired secrets', () => {
        watcher.register('expiring', 'temp-key', 'test', Date.now() - 1000);
        expect(watcher.get('expiring')).toBeNull();
    });

    it('should check expiry and generate alerts', () => {
        // Already expired
        watcher.register('expired', 'old-key', 'test', Date.now() - 1000);
        // Expiring soon (within 1 hour)
        watcher.register('soon', 'temp-key', 'test', Date.now() + 30 * 60 * 1000);

        const alerts = watcher.checkExpiry(60 * 60 * 1000); // 1h warning
        expect(alerts.length).toBeGreaterThanOrEqual(2);
        expect(alerts.some(a => a.type === 'expired')).toBe(true);
        expect(alerts.some(a => a.type === 'expiring-soon')).toBe(true);
    });

    it('should delete secrets', () => {
        expect(watcher.delete('openai')).toBe(true);
        expect(watcher.get('openai')).toBeNull();
        expect(watcher.count()).toBe(1);
    });

    it('should list secrets with masked values', () => {
        const list = watcher.list();
        expect(list).toHaveLength(2);
        expect(list.every(s => s.masked.startsWith('****'))).toBe(true);
    });

    it('should track alerts with limit', () => {
        // Generate some alerts
        watcher.rotate('openai', 'new-1');
        watcher.rotate('openai', 'new-2');
        const alerts = watcher.getAlerts(10);
        expect(alerts.length).toBeGreaterThanOrEqual(2);
        expect(alerts.every(a => a.type === 'rotated')).toBe(true);
    });
});
