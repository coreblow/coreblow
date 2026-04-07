/**
 * CoreBlow Phase 30 — Billing & Compliance Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   UsageBilling.record → ResourceLimiter.getPercentage →
 *   UsageBilling.generateInvoice → TenantManager.updatePlan
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase30 Chain: Billing & Compliance Pipeline', () => {
    let tm: TenantManager;
    let rl: ResourceLimiter;
    let billing: UsageBilling;
    let audit: EventStore;

    beforeEach(() => {
        tm = new TenantManager();
        rl = new ResourceLimiter();
        billing = new UsageBilling();
        audit = new EventStore();
    });

    // ── Billing Cycle ──

    it('full billing cycle: record → check limits → generate invoice → verify', () => {
        const tenant = tm.create('Billed Corp', 'pro');
        rl.setLimits(tenant.id, { maxApiCalls: 50000 });

        const start = Date.now() - 1000;

        // Simulate usage over a billing period
        billing.record(tenant.id, 'api_calls', 10000);
        billing.record(tenant.id, 'tokens', 500000);
        billing.record(tenant.id, 'storage_mb', 50);
        rl.record(tenant.id, 'api', 10000);

        // Check resource health
        const pct = rl.getPercentage(tenant.id)!;
        expect(pct.api).toBe(20); // 10000/50000

        // Generate invoice
        const invoice = billing.generateInvoice(tenant.id, start, Date.now() + 1000);

        // Verify line items
        expect(invoice.lineItems).toHaveLength(3);
        expect(invoice.totalAmount).toBeGreaterThan(0);
        expect(invoice.currency).toBe('USD');

        // API: 10000 * 0.001 = 10.00
        const apiItem = invoice.lineItems.find(l => l.metric === 'api_calls')!;
        expect(apiItem.total).toBe(10.0);

        // Tokens: 500000 * 0.00001 = 5.00
        const tokenItem = invoice.lineItems.find(l => l.metric === 'tokens')!;
        expect(tokenItem.total).toBe(5.0);
    });

    it('multi-metric billing across separate recording sessions', () => {
        const tenant = tm.create('Multi Corp', 'enterprise');
        const start = Date.now() - 1000;

        // Session 1
        billing.record(tenant.id, 'api_calls', 500);
        billing.record(tenant.id, 'tokens', 25000);

        // Session 2
        billing.record(tenant.id, 'api_calls', 500);
        billing.record(tenant.id, 'tokens', 25000);

        const invoice = billing.generateInvoice(tenant.id, start, Date.now() + 1000);

        // Should aggregate across sessions
        const apiItem = invoice.lineItems.find(l => l.metric === 'api_calls')!;
        expect(apiItem.quantity).toBe(1000); // 500 + 500
        expect(apiItem.total).toBe(1.0);

        const tokenItem = invoice.lineItems.find(l => l.metric === 'tokens')!;
        expect(tokenItem.quantity).toBe(50000); // 25000 + 25000
    });

    it('overage detection: usage exceeds plan → invoice includes excess', () => {
        const tenant = tm.create('Over Corp', 'starter');
        rl.setLimits(tenant.id, { maxApiCalls: 1000 });

        const start = Date.now() - 1000;

        // Record usage that exceeds plan limit
        billing.record(tenant.id, 'api_calls', 1500); // 500 over limit
        rl.record(tenant.id, 'api', 1500);

        // Detect overage
        expect(rl.isWithinLimits(tenant.id)).toBe(false);
        const pct = rl.getPercentage(tenant.id)!;
        expect(pct.api).toBe(150); // 150% usage

        // Invoice still generated for actual usage
        const invoice = billing.generateInvoice(tenant.id, start, Date.now() + 1000);
        expect(invoice.lineItems.find(l => l.metric === 'api_calls')!.quantity).toBe(1500);

        // Audit trail
        audit.append('billing:overage', tenant.id, {
            metric: 'api_calls',
            limit: 1000,
            actual: 1500,
            overage: 500,
        });
        expect(audit.getByType('billing:overage')).toHaveLength(1);
    });

    // ── Audit Trail ──

    it('billing records preserved after tenant deletion (compliance)', () => {
        const tenant = tm.create('Audit Corp', 'pro');
        const start = Date.now() - 1000;

        billing.record(tenant.id, 'api_calls', 5000);
        billing.record(tenant.id, 'tokens', 100000);
        const invoice = billing.generateInvoice(tenant.id, start, Date.now() + 1000);

        // Record audit event
        audit.append('invoice:generated', 'billing-system', {
            tenantId: tenant.id,
            invoiceId: invoice.id,
            amount: invoice.totalAmount,
        });

        // Delete tenant
        tm.delete(tenant.id);
        expect(tm.get(tenant.id)).toBeNull();

        // Billing records STILL exist (compliance requirement)
        expect(billing.getInvoices(tenant.id)).toHaveLength(1);
        expect(billing.getCurrentUsage(tenant.id).api_calls).toBe(5000);

        // Audit trail intact
        const trail = audit.getEvents('billing-system');
        expect(trail).toHaveLength(1);
        expect(trail[0]!.payload.tenantId).toBe(tenant.id);
    });

    it('invoice with EventStore cross-reference for full audit', () => {
        const tenant = tm.create('Full Audit Corp', 'enterprise');
        const start = Date.now() - 1000;

        // Record each usage event in both billing AND EventStore
        const usageEvents = [
            { metric: 'api_calls', qty: 2000 },
            { metric: 'tokens', qty: 100000 },
            { metric: 'storage_mb', qty: 25 },
        ];

        for (const u of usageEvents) {
            billing.record(tenant.id, u.metric, u.qty);
            audit.append('usage:recorded', tenant.id, { metric: u.metric, quantity: u.qty });
        }

        // Generate invoice
        const invoice = billing.generateInvoice(tenant.id, start, Date.now() + 1000);
        audit.append('invoice:created', tenant.id, { invoiceId: invoice.id, total: invoice.totalAmount });

        // Verify EventStore has complete audit trail
        const events = audit.getEvents(tenant.id);
        expect(events).toHaveLength(4); // 3 usage + 1 invoice
        expect(events[3]!.type).toBe('invoice:created');
        expect(events[3]!.payload.total).toBe(invoice.totalAmount);
    });
});
