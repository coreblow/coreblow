/**
 * CoreBlow Phase 30 — Multi-tenancy & Isolation Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { NamespaceIsolation } from '../../src/security/namespace-isolation.js';
import { TenantConfig } from '../../src/gateway/tenant-config.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';

// ================================================================
describe('TenantManager', () => {
    let tm: TenantManager;
    beforeEach(() => { tm = new TenantManager(); });

    it('should create tenants', () => {
        const t = tm.create('Acme Corp');
        expect(t.slug).toBe('acme-corp');
        expect(tm.count()).toBe(1);
    });

    it('should find by slug', () => {
        tm.create('Acme Corp');
        expect(tm.findBySlug('acme-corp')).toBeTruthy();
    });

    it('should suspend', () => {
        const t = tm.create('Test');
        tm.suspend(t.id, 'nonpayment');
        expect(tm.get(t.id)?.status).toBe('suspended');
    });

    it('should activate', () => {
        const t = tm.create('Test');
        tm.suspend(t.id);
        tm.activate(t.id);
        expect(tm.get(t.id)?.status).toBe('active');
    });

    it('should update plan', () => {
        const t = tm.create('Test', 'free');
        tm.updatePlan(t.id, 'pro', { maxUsers: 100 });
        expect(tm.get(t.id)?.plan).toBe('pro');
    });

    it('should list by status', () => {
        tm.create('A'); const b = tm.create('B'); tm.suspend(b.id);
        expect(tm.list('active')).toHaveLength(1);
    });

    it('should delete', () => {
        const t = tm.create('Test');
        tm.delete(t.id);
        expect(tm.count()).toBe(0);
    });
});

// ================================================================
describe('ResourceLimiter', () => {
    let rl: ResourceLimiter;
    beforeEach(() => { rl = new ResourceLimiter(); });

    it('should record usage', () => {
        rl.record('t1', 'api', 1);
        expect(rl.getUsage('t1')?.apiCalls).toBe(1);
    });

    it('should check within limits', () => {
        rl.record('t1', 'api', 1);
        expect(rl.isWithinLimits('t1')).toBe(true);
    });

    it('should warn at 80%', () => {
        rl.setLimits('t1', { maxApiCalls: 10 });
        const result = rl.record('t1', 'api', 9);
        expect(result.warning).toBeTruthy();
    });

    it('should reject at limit', () => {
        rl.setLimits('t1', { maxApiCalls: 5 });
        for (let i = 0; i < 5; i++) rl.record('t1', 'api', 1);
        const result = rl.record('t1', 'api', 1);
        expect(result.allowed).toBe(false);
    });

    it('should get percentage', () => {
        rl.setLimits('t1', { maxApiCalls: 100 });
        rl.record('t1', 'api', 50);
        expect(rl.getPercentage('t1')?.api).toBe(50);
    });

    it('should reset', () => {
        rl.record('t1', 'api', 100);
        rl.reset('t1');
        expect(rl.getUsage('t1')?.apiCalls).toBe(0);
    });
});

// ================================================================
describe('NamespaceIsolation', () => {
    let ns: NamespaceIsolation;
    beforeEach(() => { ns = new NamespaceIsolation(); });

    it('should set/get values', () => {
        ns.set('tenant-1', 'config', { theme: 'dark' });
        expect(ns.get('tenant-1', 'config')).toEqual({ theme: 'dark' });
    });

    it('should isolate tenants', () => {
        ns.set('t1', 'key', 'value-1');
        ns.set('t2', 'key', 'value-2');
        expect(ns.get('t1', 'key')).toBe('value-1');
        expect(ns.get('t2', 'key')).toBe('value-2');
    });

    it('should list keys per namespace', () => {
        ns.set('t1', 'a', 1);
        ns.set('t1', 'b', 2);
        ns.set('t2', 'c', 3);
        expect(ns.keys('t1')).toHaveLength(2);
    });

    it('should clear namespace', () => {
        ns.set('t1', 'a', 1);
        ns.set('t1', 'b', 2);
        expect(ns.clearNamespace('t1')).toBe(2);
    });

    it('should list namespaces', () => {
        ns.set('t1', 'a', 1);
        ns.set('t2', 'b', 2);
        expect(ns.listNamespaces()).toHaveLength(2);
    });

    it('should get all in namespace', () => {
        ns.set('t1', 'x', 10);
        ns.set('t1', 'y', 20);
        const all = ns.getAll('t1');
        expect(all.x).toBe(10);
        expect(all.y).toBe(20);
    });
});

// ================================================================
describe('TenantConfig', () => {
    let tc: TenantConfig;
    beforeEach(() => {
        tc = new TenantConfig();
        tc.setDefaults({ model: 'gpt-4', maxTokens: 4096 });
    });

    it('should resolve defaults', () => {
        const config = tc.resolve('t1');
        expect(config.model).toBe('gpt-4');
    });

    it('should override defaults', () => {
        tc.set('t1', { model: 'claude-3' });
        expect(tc.resolve('t1').model).toBe('claude-3');
        expect(tc.resolve('t1').maxTokens).toBe(4096);
    });

    it('should manage features', () => {
        tc.setFeature('t1', 'beta-ui', true);
        expect(tc.hasFeature('t1', 'beta-ui')).toBe(true);
    });

    it('should set branding', () => {
        tc.setBranding('t1', { name: 'Acme Bot', primaryColor: '#ff0000' });
        expect(tc.getBranding('t1')?.name).toBe('Acme Bot');
    });

    it('should return null for unknown tenant branding', () => {
        expect(tc.getBranding('unknown')).toBeNull();
    });
});

// ================================================================
describe('UsageBilling', () => {
    let billing: UsageBilling;
    beforeEach(() => { billing = new UsageBilling(); });

    it('should record usage', () => {
        billing.record('t1', 'api_calls', 100);
        expect(billing.count()).toBe(1);
    });

    it('should get current usage', () => {
        billing.record('t1', 'api_calls', 50);
        billing.record('t1', 'api_calls', 30);
        expect(billing.getCurrentUsage('t1').api_calls).toBe(80);
    });

    it('should generate invoices', () => {
        const start = Date.now() - 1000;
        billing.record('t1', 'api_calls', 1000);
        billing.record('t1', 'tokens', 50000);
        const invoice = billing.generateInvoice('t1', start, Date.now() + 1000);
        expect(invoice.lineItems.length).toBeGreaterThan(0);
        expect(invoice.totalAmount).toBeGreaterThan(0);
    });

    it('should set custom pricing', () => {
        billing.setPrice('api_calls', 0.01);
        const start = Date.now() - 1000;
        billing.record('t1', 'api_calls', 100);
        const inv = billing.generateInvoice('t1', start, Date.now() + 1000);
        expect(inv.totalAmount).toBe(1);
    });

    it('should get invoices by tenant', () => {
        billing.record('t1', 'api_calls', 10);
        billing.generateInvoice('t1', 0, Date.now() + 1000);
        expect(billing.getInvoices('t1')).toHaveLength(1);
    });

    it('should track total revenue', () => {
        billing.record('t1', 'api_calls', 1000);
        billing.generateInvoice('t1', 0, Date.now() + 1000);
        expect(billing.getTotalRevenue()).toBeGreaterThan(0);
    });
});
