// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { SecretWatcher } from './secret-watcher.js';

describe('Secret Watcher — Phase 6', () => {
    let watcher: SecretWatcher;

    beforeEach(() => {
        watcher = new SecretWatcher();
    });

    it('registers and gets secret', () => {
        watcher.register('openai-key', 'sk-abc123def456');
        expect(watcher.get('openai-key')).toBe('sk-abc123def456');
        expect(watcher.count()).toBe(1);
    });

    it('returns null for missing key', () => {
        expect(watcher.get('nonexistent')).toBeNull();
    });

    it('masks secret values', () => {
        watcher.register('key', 'sk-abcdef123456');
        const masked = watcher.getMasked('key');
        expect(masked).toBe('****3456');
        expect(masked).not.toContain('sk-abc');
    });

    it('masks short secrets fully', () => {
        watcher.register('pin', '1234');
        expect(watcher.getMasked('pin')).toBe('****');
    });

    it('rotates secret', () => {
        watcher.register('key', 'old-value');
        const rotated = watcher.rotate('key', 'new-value');
        expect(rotated).toBe(true);
        expect(watcher.get('key')).toBe('new-value');
    });

    it('tracks rotation count', () => {
        watcher.register('key', 'v1');
        watcher.rotate('key', 'v2');
        watcher.rotate('key', 'v3');
        const list = watcher.list();
        expect(list[0]!.rotationCount).toBe(2);
    });

    it('returns null for expired secret', () => {
        watcher.register('temp', 'value', undefined, Date.now() - 1000);
        expect(watcher.get('temp')).toBeNull();
    });

    it('checkExpiry detects expired', () => {
        watcher.register('temp', 'value', undefined, Date.now() - 1000);
        const alerts = watcher.checkExpiry();
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts[0]!.type).toBe('expired');
    });

    it('checkExpiry detects expiring-soon', () => {
        const soonMs = Date.now() + 3600_000; // 1h from now
        watcher.register('api-key', 'value', 'openai', soonMs);
        const alerts = watcher.checkExpiry(48 * 3600_000); // 48h warning window
        expect(alerts.some(a => a.type === 'expiring-soon')).toBe(true);
    });

    it('scanForLeaks detects secret in text', () => {
        watcher.register('key', 'super-secret-token-xyz');
        const leaks = watcher.scanForLeaks('The config contains super-secret-token-xyz visible');
        expect(leaks).toHaveLength(1);
        expect(leaks[0]!.type).toBe('leaked');
    });

    it('scanForLeaks returns empty for clean text', () => {
        watcher.register('key', 'hidden-token');
        expect(watcher.scanForLeaks('This text is safe')).toHaveLength(0);
    });

    it('delete removes secret', () => {
        watcher.register('key', 'val');
        expect(watcher.delete('key')).toBe(true);
        expect(watcher.get('key')).toBeNull();
        expect(watcher.count()).toBe(0);
    });

    it('list shows masked secrets', () => {
        watcher.register('k1', 'secret1', 'openai');
        watcher.register('k2', 'secret2', 'anthropic');
        const list = watcher.list();
        expect(list).toHaveLength(2);
        expect(list[0]!.masked).not.toContain('secret');
        expect(list[0]!.provider).toBe('openai');
    });

    it('getAlerts tracks history', () => {
        watcher.register('k', 'old');
        watcher.rotate('k', 'new');
        const alerts = watcher.getAlerts();
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(a => a.type === 'rotated')).toBe(true);
    });
});
