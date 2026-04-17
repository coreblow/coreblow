/**
 * CoreBlow Phase 30 — Tenant Onboarding Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   TenantManager.create → TenantConfig.setDefaults → NamespaceIsolation.set
 *   → ResourceLimiter.setLimits → UsageBilling.record
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { TenantConfig } from '../../src/gateway/tenant-config.js';
import { NamespaceIsolation } from '../../src/security/namespace-isolation.js';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';

describe('Phase30 Chain: Tenant Onboarding Pipeline', () => {
    let tm: TenantManager;
    let tc: TenantConfig;
    let ns: NamespaceIsolation;
    let rl: ResourceLimiter;
    let billing: UsageBilling;

    beforeEach(() => {
        tm = new TenantManager();
        tc = new TenantConfig();
        ns = new NamespaceIsolation();
        rl = new ResourceLimiter();
        billing = new UsageBilling();

        tc.setDefaults({ model: 'gpt-4', maxTokens: 4096 });
    });

    // ── New Tenant Signup ──

    it('complete onboarding: create → config → namespace → limits → usage', () => {
        // Step 1: Create tenant
        const tenant = tm.create('Acme Corp', 'pro', { maxUsers: 100 });
        expect(tenant.status).toBe('active');

        // Step 2: Configure tenant
        tc.set(tenant.id, { model: 'claude-3', maxTokens: 8192 });
        tc.setFeature(tenant.id, 'streaming', true);
        tc.setBranding(tenant.id, { name: 'AcmeBot', primaryColor: '#0066ff' });

        // Step 3: Allocate namespace
        ns.set(tenant.id, 'settings', tc.resolve(tenant.id));
        ns.set(tenant.id, 'branding', tc.getBranding(tenant.id));

        // Step 4: Set resource limits based on plan
        rl.setLimits(tenant.id, { maxApiCalls: 50000, maxStorageMB: 500 });

        // Step 5: Record initial setup usage
        billing.record(tenant.id, 'api_calls', 1); // Onboarding API call

        // Verify complete pipeline
        expect(tm.get(tenant.id)?.plan).toBe('pro');
        expect(tc.resolve(tenant.id).model).toBe('claude-3');
        expect(ns.get(tenant.id, 'settings')).toEqual({ model: 'claude-3', maxTokens: 8192 });
        expect(rl.isWithinLimits(tenant.id)).toBe(true);
        expect(billing.count()).toBe(1);
    });

    it('pro plan upgrade: create free → upgrade → adjust limits → verify', () => {
        // Start on free plan
        const tenant = tm.create('Startup Inc', 'free', { maxUsers: 5 });
        rl.setLimits(tenant.id, { maxApiCalls: 1000, maxStorageMB: 10 });

        // Use up some resources
        rl.record(tenant.id, 'api', 800); // 80% of free limit
        const pctBefore = rl.getPercentage(tenant.id)!;
        expect(pctBefore.api).toBe(80);

        // Upgrade to pro
        tm.updatePlan(tenant.id, 'pro', { maxUsers: 100 });
        rl.setLimits(tenant.id, { maxApiCalls: 50000, maxStorageMB: 500 });
        tc.set(tenant.id, { model: 'gpt-4o' });
        tc.setFeature(tenant.id, 'advanced-analytics', true);

        // After upgrade — same usage but much lower percentage
        const pctAfter = rl.getPercentage(tenant.id)!;
        expect(pctAfter.api).toBe(1.6); // 800/50000 * 100
        expect(tm.get(tenant.id)?.plan).toBe('pro');
        expect(tc.hasFeature(tenant.id, 'advanced-analytics')).toBe(true);
    });

    it('trial → active activation: verify limits expanded', () => {
        const tenant = tm.create('Trial Co', 'trial', { maxUsers: 2, maxChannels: 1, maxAgents: 1 });
        rl.setLimits(tenant.id, { maxApiCalls: 100 });

        // Use trial resources
        rl.record(tenant.id, 'api', 50);
        ns.set(tenant.id, 'trial-data', { startedAt: Date.now() });

        // Activate to paid plan
        tm.updatePlan(tenant.id, 'starter', { maxUsers: 25, maxChannels: 5, maxAgents: 10 });
        rl.setLimits(tenant.id, { maxApiCalls: 10000 });

        // Trial data still in namespace
        expect(ns.has(tenant.id, 'trial-data')).toBe(true);
        // Limits expanded
        expect(rl.getPercentage(tenant.id)!.api).toBe(0.5); // 50/10000 * 100
        expect(tm.get(tenant.id)?.limits.maxUsers).toBe(25);
    });

    // ── Deactivation ──

    it('suspend tenant → namespace readable → billing preserved', () => {
        const tenant = tm.create('Leaving Corp', 'pro');
        ns.set(tenant.id, 'data', { important: true });
        billing.record(tenant.id, 'api_calls', 5000);

        // Suspend
        tm.suspend(tenant.id, 'nonpayment');
        expect(tm.get(tenant.id)?.status).toBe('suspended');

        // Data still readable (for compliance)
        expect(ns.get(tenant.id, 'data')).toEqual({ important: true });
        // Billing records preserved
        expect(billing.getCurrentUsage(tenant.id).api_calls).toBe(5000);
    });

    it('delete tenant → cleanup namespace → billing preserved', () => {
        const tenant = tm.create('Delete Me', 'free');
        ns.set(tenant.id, 'config', { a: 1 });
        ns.set(tenant.id, 'sessions', { b: 2 });
        billing.record(tenant.id, 'api_calls', 100);
        const start = Date.now() - 1000;
        billing.generateInvoice(tenant.id, start, Date.now() + 1000);

        // Delete tenant and clean namespace
        tm.delete(tenant.id);
        ns.clearNamespace(tenant.id);

        // Tenant gone
        expect(tm.get(tenant.id)).toBeNull();
        expect(ns.keys(tenant.id)).toHaveLength(0);
        // Billing records preserved for audit
        expect(billing.getInvoices(tenant.id)).toHaveLength(1);
    });
});
