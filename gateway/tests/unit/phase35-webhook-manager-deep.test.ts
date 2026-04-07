/**
 * CoreBlow Phase 35 — WebhookManager Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Registration, event matching, wildcard, enable/disable
 *   - HMAC signing, delivery tracking, stats, deletion
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookManager } from '../../src/channels/webhook-manager.js';

describe('WebhookManager — Extended', () => {
    let mgr: WebhookManager;
    beforeEach(() => { mgr = new WebhookManager(); });

    it('should register a webhook and return endpoint', () => {
        const wh = mgr.register('https://api.example.com/hook', ['message.new']);
        expect(wh.id).toBeTruthy();
        expect(wh.url).toBe('https://api.example.com/hook');
        expect(wh.events).toEqual(['message.new']);
        expect(wh.active).toBe(true);
    });

    it('should get registered webhook by id', () => {
        const wh = mgr.register('https://hook.io', ['*']);
        expect(mgr.get(wh.id)).not.toBeNull();
        expect(mgr.get(wh.id)?.url).toBe('https://hook.io');
    });

    it('should return null for unknown webhook', () => {
        expect(mgr.get('wh-nonexistent')).toBeNull();
    });

    it('should enable and disable webhooks', () => {
        const wh = mgr.register('https://hook.io', ['event']);
        expect(mgr.setActive(wh.id, false)).toBe(true);
        expect(mgr.get(wh.id)?.active).toBe(false);

        expect(mgr.setActive(wh.id, true)).toBe(true);
        expect(mgr.get(wh.id)?.active).toBe(true);
    });

    it('should return false when toggling unknown webhook', () => {
        expect(mgr.setActive('ghost', true)).toBe(false);
    });

    it('should delete webhooks', () => {
        const wh = mgr.register('https://hook.io', ['*']);
        expect(mgr.delete(wh.id)).toBe(true);
        expect(mgr.get(wh.id)).toBeNull();
        expect(mgr.count()).toBe(0);
    });

    it('should sign payload with HMAC-SHA256', () => {
        const signature = mgr.signPayload('{"event":"test"}', 'secret-key');
        expect(signature).toBeTruthy();
        expect(typeof signature).toBe('string');
        expect(signature.length).toBe(64); // SHA-256 hex = 64 chars

        // Same input = same signature (deterministic)
        const sig2 = mgr.signPayload('{"event":"test"}', 'secret-key');
        expect(sig2).toBe(signature);
    });

    it('should produce different signatures for different secrets', () => {
        const s1 = mgr.signPayload('same-payload', 'key-1');
        const s2 = mgr.signPayload('same-payload', 'key-2');
        expect(s1).not.toBe(s2);
    });

    it('should list webhooks', () => {
        mgr.register('https://a.com', ['event.a']);
        mgr.register('https://b.com', ['event.b']);
        const list = mgr.list();
        expect(list).toHaveLength(2);
        expect(list[0]?.url).toBe('https://a.com');
    });

    it('should track stats', () => {
        mgr.register('https://a.com', ['*']);
        mgr.register('https://b.com', ['*']);
        mgr.setActive(mgr.list()[1]!.id, false);

        const stats = mgr.getStats();
        expect(stats.total).toBe(2);
        expect(stats.active).toBe(1);
    });

    it('should count registered webhooks', () => {
        mgr.register('https://a.com', ['*']);
        mgr.register('https://b.com', ['*']);
        mgr.register('https://c.com', ['*']);
        expect(mgr.count()).toBe(3);
    });

    it('should get delivery history', () => {
        // No deliveries yet
        const deliveries = mgr.getDeliveries();
        expect(deliveries).toHaveLength(0);
    });

    it('should register webhook with secret', () => {
        const wh = mgr.register('https://secure.io', ['*'], 'my-secret');
        expect(wh.secret).toBe('my-secret');
    });
});
