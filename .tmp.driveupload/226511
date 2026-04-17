/**
 * CoreBlow Phase 30 — Tenant Lifecycle & Config Inheritance Tests
 *
 * Layer 1 (Edge Cases) for:
 *   - TenantManager: slug generation, state cycles, plan changes, metadata
 *   - TenantConfig: default inheritance, deep overrides, feature flags, branding
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { TenantConfig } from '../../src/gateway/tenant-config.js';

// ================================================================
// TenantManager — Extended Lifecycle
// ================================================================
describe('TenantManager — Lifecycle Edge Cases', () => {
    let tm: TenantManager;

    beforeEach(() => { tm = new TenantManager(); });

    it('should generate slugs from special characters', () => {
        const t1 = tm.create('Acme  Corp  Ltd');
        expect(t1.slug).toBe('acme-corp-ltd'); // \s+ collapses consecutive spaces

        const t2 = tm.create('Über Tech');
        expect(t2.slug).toBe('über-tech');

        const t3 = tm.create('My & Partners');
        expect(t3.slug).toBe('my-&-partners');
    });

    it('should handle duplicate tenant names with unique IDs', () => {
        const t1 = tm.create('Test Corp');
        const t2 = tm.create('Test Corp');
        expect(t1.id).not.toBe(t2.id);
        expect(t1.slug).toBe(t2.slug);
        expect(tm.count()).toBe(2);
    });

    it('should cycle through suspend → activate → suspend correctly', () => {
        const t = tm.create('Cycle Corp');
        expect(tm.get(t.id)?.status).toBe('active');

        tm.suspend(t.id, 'payment-failed');
        expect(tm.get(t.id)?.status).toBe('suspended');
        expect(tm.get(t.id)?.metadata?.suspendReason).toBe('payment-failed');

        tm.activate(t.id);
        expect(tm.get(t.id)?.status).toBe('active');

        tm.suspend(t.id, 'tos-violation');
        expect(tm.get(t.id)?.status).toBe('suspended');
        expect(tm.get(t.id)?.metadata?.suspendReason).toBe('tos-violation');
    });

    it('should upgrade plan with expanded limits', () => {
        const t = tm.create('Small Biz', 'free', { maxUsers: 5, maxChannels: 1, maxAgents: 2 });
        expect(tm.get(t.id)?.plan).toBe('free');
        expect(tm.get(t.id)?.limits.maxUsers).toBe(5);

        tm.updatePlan(t.id, 'pro', { maxUsers: 100, maxChannels: 10, maxAgents: 50 });
        expect(tm.get(t.id)?.plan).toBe('pro');
        expect(tm.get(t.id)?.limits.maxUsers).toBe(100);
        expect(tm.get(t.id)?.limits.maxChannels).toBe(10);
    });

    it('should downgrade plan with reduced limits', () => {
        const t = tm.create('Big Corp', 'enterprise', { maxUsers: 1000 });
        tm.updatePlan(t.id, 'free', { maxUsers: 10 });
        expect(tm.get(t.id)?.plan).toBe('free');
        expect(tm.get(t.id)?.limits.maxUsers).toBe(10);
    });

    it('should delete suspended tenants', () => {
        const t = tm.create('Gone Corp');
        tm.suspend(t.id);
        expect(tm.delete(t.id)).toBe(true);
        expect(tm.get(t.id)).toBeNull();
        expect(tm.count()).toBe(0);
    });

    it('should return false for operations on non-existent tenants', () => {
        expect(tm.suspend('fake-id')).toBe(false);
        expect(tm.activate('fake-id')).toBe(false);
        expect(tm.updatePlan('fake-id', 'pro')).toBe(false);
        expect(tm.get('fake-id')).toBeNull();
    });

    it('should list tenants filtered by status correctly', () => {
        tm.create('Active-1');
        tm.create('Active-2');
        const s = tm.create('Suspended');
        tm.suspend(s.id);

        expect(tm.list('active')).toHaveLength(2);
        expect(tm.list('suspended')).toHaveLength(1);
        expect(tm.list()).toHaveLength(3); // All
    });
});

// ================================================================
// TenantConfig — Inheritance & Feature Flags
// ================================================================
describe('TenantConfig — Inheritance Edge Cases', () => {
    let tc: TenantConfig;

    beforeEach(() => {
        tc = new TenantConfig();
        tc.setDefaults({ model: 'gpt-4', maxTokens: 4096, temperature: 0.7, streaming: true });
    });

    it('should resolve pure defaults for unconfigured tenant', () => {
        const config = tc.resolve('new-tenant');
        expect(config.model).toBe('gpt-4');
        expect(config.maxTokens).toBe(4096);
        expect(config.temperature).toBe(0.7);
    });

    it('should merge partial overrides with defaults', () => {
        tc.set('tenant-1', { model: 'claude-3', temperature: 0.9 });
        const config = tc.resolve('tenant-1');
        expect(config.model).toBe('claude-3');         // overridden
        expect(config.temperature).toBe(0.9);           // overridden
        expect(config.maxTokens).toBe(4096);            // from defaults
        expect(config.streaming).toBe(true);            // from defaults
    });

    it('should accumulate overrides across multiple set() calls', () => {
        tc.set('t1', { model: 'claude-3' });
        tc.set('t1', { temperature: 0.5 });
        const config = tc.resolve('t1');
        expect(config.model).toBe('claude-3');
        expect(config.temperature).toBe(0.5);
    });

    it('should toggle feature flags on/off', () => {
        tc.setFeature('t1', 'beta-ui', true);
        expect(tc.hasFeature('t1', 'beta-ui')).toBe(true);

        tc.setFeature('t1', 'beta-ui', false);
        expect(tc.hasFeature('t1', 'beta-ui')).toBe(false);
    });

    it('should return false for unset feature flags', () => {
        expect(tc.hasFeature('unknown-tenant', 'any-feature')).toBe(false);
    });

    it('should update branding incrementally', () => {
        tc.setBranding('t1', { name: 'AcmeBot' });
        expect(tc.getBranding('t1')?.name).toBe('AcmeBot');

        tc.setBranding('t1', { primaryColor: '#ff0000' });
        expect(tc.getBranding('t1')?.name).toBe('AcmeBot');
        expect(tc.getBranding('t1')?.primaryColor).toBe('#ff0000');
    });

    it('should maintain independent configs per tenant', () => {
        tc.set('t-alpha', { model: 'gpt-4o' });
        tc.set('t-beta', { model: 'claude-3.5' });

        expect(tc.resolve('t-alpha').model).toBe('gpt-4o');
        expect(tc.resolve('t-beta').model).toBe('claude-3.5');
        // Unmodified tenant still gets defaults
        expect(tc.resolve('t-gamma').model).toBe('gpt-4');
    });
});
