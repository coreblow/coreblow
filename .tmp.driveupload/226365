/**
 * CoreBlow Phase 30 — Multi-Tenant Isolation & Chaos Tests
 *
 * Layer 3 (Security Boundary):
 *   - Cross-tenant data leakage prevention
 *   - Concurrent tenant operations
 *   - Resource exhaustion isolation
 *
 * ⚠️ SECURITY CRITICAL — These tests verify the multi-tenancy
 * isolation boundary that prevents one tenant from accessing
 * another tenant's data.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { TenantConfig } from '../../src/gateway/tenant-config.js';
import { NamespaceIsolation } from '../../src/security/namespace-isolation.js';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';

// ================================================================
// Cross-Tenant Data Leakage Prevention
// ================================================================
describe('Phase30 Chaos: Cross-Tenant Data Leakage Prevention', () => {
    let tm: TenantManager;
    let tc: TenantConfig;
    let ns: NamespaceIsolation;
    let rl: ResourceLimiter;
    let billing: UsageBilling;
    let tenantA: string;
    let tenantB: string;

    beforeEach(() => {
        tm = new TenantManager();
        tc = new TenantConfig();
        ns = new NamespaceIsolation();
        rl = new ResourceLimiter();
        billing = new UsageBilling();

        tc.setDefaults({ model: 'gpt-4', maxTokens: 4096 });

        // Create two isolated tenants
        tenantA = tm.create('Corp Alpha', 'enterprise').id;
        tenantB = tm.create('Corp Beta', 'pro').id;
    });

    it('tenant A namespace data NEVER visible to tenant B', () => {
        // Store sensitive data for each tenant
        ns.set(tenantA, 'api-key', 'sk-alpha-secret-12345');
        ns.set(tenantA, 'users', [{ name: 'Alice', email: 'alice@alpha.com' }]);

        ns.set(tenantB, 'api-key', 'sk-beta-secret-67890');
        ns.set(tenantB, 'users', [{ name: 'Bob', email: 'bob@beta.com' }]);

        // Verify complete isolation
        expect(ns.get(tenantA, 'api-key')).toBe('sk-alpha-secret-12345');
        expect(ns.get(tenantB, 'api-key')).toBe('sk-beta-secret-67890');

        // Attempting to access tenant A's data from tenant B's namespace
        // should return undefined, not tenant A's data
        expect(ns.get(tenantB, 'api-key')).not.toBe('sk-alpha-secret-12345');

        // Keys should be completely separate
        const keysA = ns.keys(tenantA);
        const keysB = ns.keys(tenantB);
        expect(keysA).toHaveLength(2);
        expect(keysB).toHaveLength(2);

        // getAll should not leak
        const allA = ns.getAll(tenantA);
        const allB = ns.getAll(tenantB);
        expect(allA['api-key']).toBe('sk-alpha-secret-12345');
        expect(allB['api-key']).toBe('sk-beta-secret-67890');
    });

    it('tenant A config overrides NEVER leak into tenant B resolution', () => {
        tc.set(tenantA, { model: 'claude-3.5', temperature: 0.2 });
        tc.set(tenantB, { model: 'gemini-pro', temperature: 0.9 });

        tc.setFeature(tenantA, 'premium-tools', true);
        tc.setBranding(tenantA, { name: 'Alpha Assistant' });

        const configA = tc.resolve(tenantA);
        const configB = tc.resolve(tenantB);

        // Config isolation
        expect(configA.model).toBe('claude-3.5');
        expect(configB.model).toBe('gemini-pro');
        expect(configA.temperature).not.toBe(configB.temperature);

        // Feature isolation
        expect(tc.hasFeature(tenantA, 'premium-tools')).toBe(true);
        expect(tc.hasFeature(tenantB, 'premium-tools')).toBe(false);

        // Branding isolation
        expect(tc.getBranding(tenantA)?.name).toBe('Alpha Assistant');
        expect(tc.getBranding(tenantB)).toBeNull();
    });

    it('resource limits for tenant A dont affect tenant B budget', () => {
        rl.setLimits(tenantA, { maxApiCalls: 100 });
        rl.setLimits(tenantB, { maxApiCalls: 100 });

        // Exhaust tenant A's budget
        for (let i = 0; i < 100; i++) rl.record(tenantA, 'api', 1);
        const resultA = rl.record(tenantA, 'api', 1);
        expect(resultA.allowed).toBe(false);

        // Tenant B should be completely unaffected
        const resultB = rl.record(tenantB, 'api', 1);
        expect(resultB.allowed).toBe(true);
        expect(rl.getPercentage(tenantB)!.api).toBe(1);

        // Isolation verification
        expect(rl.isWithinLimits(tenantA)).toBe(false);
        expect(rl.isWithinLimits(tenantB)).toBe(true);
    });

    it('billing records for tenant A excluded from tenant B invoice', () => {
        const start = Date.now() - 1000;

        billing.record(tenantA, 'api_calls', 10000);
        billing.record(tenantA, 'tokens', 500000);
        billing.record(tenantB, 'api_calls', 100);

        const invoiceA = billing.generateInvoice(tenantA, start, Date.now() + 1000);
        const invoiceB = billing.generateInvoice(tenantB, start, Date.now() + 1000);

        // Invoice amounts must be different
        expect(invoiceA.totalAmount).toBeGreaterThan(invoiceB.totalAmount);

        // Tenant A's invoice should not include tenant B's records
        expect(invoiceA.tenantId).toBe(tenantA);
        expect(invoiceB.tenantId).toBe(tenantB);

        // Tenant B only has 1 line item (api_calls)
        expect(invoiceB.lineItems).toHaveLength(1);
        expect(invoiceB.lineItems[0]!.quantity).toBe(100);
    });
});

// ================================================================
// Concurrent Access
// ================================================================
describe('Phase30 Chaos: Concurrent Access', () => {
    it('concurrent tenant creations — no ID collisions', () => {
        const tm = new TenantManager();
        const tenants = Array.from({ length: 10 }, (_, i) => tm.create(`Tenant-${i}`));

        // All IDs unique
        const ids = new Set(tenants.map(t => t.id));
        expect(ids.size).toBe(10);

        // All slugs generated
        expect(tenants.every(t => t.slug.startsWith('tenant-'))).toBe(true);
        expect(tm.count()).toBe(10);
    });

    it('concurrent resource recording — per-tenant counters consistent', () => {
        const rl = new ResourceLimiter();
        rl.setLimits('t1', { maxApiCalls: 10000 });
        rl.setLimits('t2', { maxApiCalls: 10000 });

        // Simulate concurrent recording
        const results: Array<{ allowed: boolean }> = [];
        for (let i = 0; i < 100; i++) {
            results.push(rl.record(i % 2 === 0 ? 't1' : 't2', 'api', 1));
        }

        // All should be allowed (well within limits)
        expect(results.every(r => r.allowed)).toBe(true);

        // Each tenant should have exactly 50
        expect(rl.getUsage('t1')!.apiCalls).toBe(50);
        expect(rl.getUsage('t2')!.apiCalls).toBe(50);
    });

    it('concurrent config resolution — no cross-tenant contamination', () => {
        const tc = new TenantConfig();
        tc.setDefaults({ model: 'gpt-4' });

        // Set 20 different tenant configs
        for (let i = 0; i < 20; i++) {
            tc.set(`t-${i}`, { model: `model-${i}`, customField: i });
        }

        // Resolve all concurrently and verify isolation
        const configs = Array.from({ length: 20 }, (_, i) => tc.resolve(`t-${i}`));

        for (let i = 0; i < 20; i++) {
            expect(configs[i]!.model).toBe(`model-${i}`);
            expect(configs[i]!.customField).toBe(i);
        }
    });
});

// ================================================================
// Resource Exhaustion
// ================================================================
describe('Phase30 Chaos: Resource Exhaustion', () => {
    it('single tenant hits all 4 limits — other tenants unaffected', () => {
        const rl = new ResourceLimiter();

        rl.setLimits('exhausted', { maxApiCalls: 10, maxCpuMs: 100, maxStorageMB: 1, maxMemoryMB: 64 });
        rl.setLimits('healthy', { maxApiCalls: 10, maxCpuMs: 100, maxStorageMB: 1, maxMemoryMB: 64 });

        // Push OVER all limits (isWithinLimits uses <=, so exactly-at is still within)
        for (let i = 0; i < 11; i++) rl.record('exhausted', 'api', 1);
        rl.record('exhausted', 'cpu', 101);
        rl.record('exhausted', 'storage', 2);
        rl.record('exhausted', 'memory', 65);

        expect(rl.isWithinLimits('exhausted')).toBe(false);

        // Other tenant completely healthy
        rl.record('healthy', 'api', 1);
        expect(rl.isWithinLimits('healthy')).toBe(true);
        expect(rl.getPercentage('healthy')!.api).toBe(10);
    });

    it('namespace with 1000 keys — isolation checks remain accurate', () => {
        const ns = new NamespaceIsolation();

        // Create large namespace
        for (let i = 0; i < 1000; i++) {
            ns.set('big-tenant', `key-${i}`, { data: `value-${i}` });
        }

        // Small tenant
        ns.set('small-tenant', 'only-key', 'only-value');

        // Verify isolation at scale
        expect(ns.keys('big-tenant')).toHaveLength(1000);
        expect(ns.keys('small-tenant')).toHaveLength(1);
        expect(ns.get('small-tenant', 'key-0')).toBeUndefined();
        expect(ns.get('big-tenant', 'only-key')).toBeUndefined();

        // Listing namespaces should be accurate
        const namespaces = ns.listNamespaces();
        expect(namespaces).toHaveLength(2);
        expect(namespaces.find(n => n.namespace === 'big-tenant')!.entryCount).toBe(1000);
        expect(namespaces.find(n => n.namespace === 'small-tenant')!.entryCount).toBe(1);
    });

    it('billing with 100+ records per tenant — invoice accuracy maintained', () => {
        const billing = new UsageBilling();
        const start = Date.now() - 1000;

        // Record 200 small usage events
        for (let i = 0; i < 200; i++) {
            billing.record('heavy-user', 'api_calls', 10);
        }

        const invoice = billing.generateInvoice('heavy-user', start, Date.now() + 1000);

        // Should aggregate all 200 records
        const apiItem = invoice.lineItems.find(l => l.metric === 'api_calls')!;
        expect(apiItem.quantity).toBe(2000); // 200 * 10
        expect(apiItem.total).toBe(2.0);     // 2000 * 0.001
        expect(invoice.totalAmount).toBe(2.0);
    });
});
