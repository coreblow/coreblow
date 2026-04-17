/**
 * CoreBlow Phase 30 — Resource Limiter & Usage Billing Edge Cases
 *
 * Layer 1 (Boundaries & Math) for:
 *   - ResourceLimiter: threshold precision, multi-resource, reset, concurrent recording
 *   - UsageBilling: invoice math, period filtering, custom pricing, decimal precision
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';

// ================================================================
// ResourceLimiter — Boundary Precision
// ================================================================
describe('ResourceLimiter — Boundaries', () => {
    let rl: ResourceLimiter;

    beforeEach(() => { rl = new ResourceLimiter(); });

    it('should warn at exactly 80% for each resource type', () => {
        rl.setLimits('t1', { maxApiCalls: 100 });
        const result = rl.record('t1', 'api', 80);
        expect(result.allowed).toBe(true);
        expect(result.warning).toBeTruthy();
    });

    it('should allow at 79% without warning', () => {
        rl.setLimits('t1', { maxApiCalls: 100 });
        const result = rl.record('t1', 'api', 79);
        expect(result.allowed).toBe(true);
        expect(result.warning).toBeUndefined();
    });

    it('should reject at exactly 100%', () => {
        rl.setLimits('t1', { maxApiCalls: 10 });
        // Use up all 10
        for (let i = 0; i < 10; i++) rl.record('t1', 'api', 1);
        // 11th should be rejected
        const result = rl.record('t1', 'api', 1);
        expect(result.allowed).toBe(false);
    });

    it('should track each resource type independently', () => {
        rl.setLimits('t1', { maxApiCalls: 100, maxCpuMs: 5000, maxStorageMB: 50 });
        rl.record('t1', 'api', 50);
        rl.record('t1', 'cpu', 2500);
        rl.record('t1', 'storage', 25);

        const pct = rl.getPercentage('t1')!;
        expect(pct.api).toBe(50);
        expect(pct.cpu).toBe(50);
        expect(pct.storage).toBe(50);
    });

    it('should reset all metrics and warnings', () => {
        rl.setLimits('t1', { maxApiCalls: 10 });
        rl.record('t1', 'api', 9); // 90% — triggers warning
        const usage = rl.getUsage('t1')!;
        expect(usage.warnings.length).toBeGreaterThan(0);

        rl.reset('t1');
        const after = rl.getUsage('t1')!;
        expect(after.apiCalls).toBe(0);
        expect(after.cpuMs).toBe(0);
        expect(after.warnings).toHaveLength(0);
    });

    it('should apply default limits when no custom limits set', () => {
        rl.record('t1', 'api', 1);
        // Default maxApiCalls is 10_000
        expect(rl.isWithinLimits('t1')).toBe(true);
        const pct = rl.getPercentage('t1')!;
        expect(pct.api).toBeCloseTo(0.01, 1); // 1/10000 * 100
    });

    it('should handle memory as high-water mark (Math.max)', () => {
        rl.record('t1', 'memory', 100);
        rl.record('t1', 'memory', 200);
        rl.record('t1', 'memory', 150); // Lower — Math.max retains peak
        const usage = rl.getUsage('t1')!;
        expect(usage.memoryMB).toBe(200); // Peak value retained
    });

    it('should return null for unknown tenant usage', () => {
        expect(rl.getUsage('nonexistent')).toBeNull();
        expect(rl.getPercentage('nonexistent')).toBeNull();
    });
});

// ================================================================
// UsageBilling — Invoice Math Precision
// ================================================================
describe('UsageBilling — Math & Invoicing', () => {
    let billing: UsageBilling;

    beforeEach(() => { billing = new UsageBilling(); });

    it('should generate multi-metric invoice', () => {
        const start = Date.now() - 1000;
        billing.record('t1', 'api_calls', 1000);
        billing.record('t1', 'tokens', 50000);
        billing.record('t1', 'storage_mb', 10);

        const inv = billing.generateInvoice('t1', start, Date.now() + 1000);
        expect(inv.lineItems).toHaveLength(3);

        const apiLine = inv.lineItems.find(l => l.metric === 'api_calls')!;
        expect(apiLine.quantity).toBe(1000);
        expect(apiLine.total).toBe(1.0); // 1000 * 0.001

        const tokenLine = inv.lineItems.find(l => l.metric === 'tokens')!;
        expect(tokenLine.quantity).toBe(50000);
        expect(tokenLine.total).toBe(0.5); // 50000 * 0.00001
    });

    it('should apply custom pricing correctly', () => {
        billing.setPrice('api_calls', 0.01); // 10x default
        const start = Date.now() - 1000;
        billing.record('t1', 'api_calls', 100);

        const inv = billing.generateInvoice('t1', start, Date.now() + 1000);
        expect(inv.totalAmount).toBe(1.0); // 100 * 0.01
    });

    it('should exclude records outside invoice period', () => {
        billing.record('t1', 'api_calls', 500); // Recorded now
        // Invoice for a past period that doesn't include "now"
        const inv = billing.generateInvoice('t1', 0, 1000);
        expect(inv.lineItems).toHaveLength(0);
        expect(inv.totalAmount).toBe(0);
    });

    it('should aggregate revenue across multiple invoices', () => {
        const start = Date.now() - 1000;
        const end = Date.now() + 1000;

        billing.record('t1', 'api_calls', 1000);
        billing.generateInvoice('t1', start, end);

        billing.record('t2', 'api_calls', 2000);
        billing.generateInvoice('t2', start, end);

        // 1000 * 0.001 + 2000 * 0.001 = 1.0 + 2.0
        expect(billing.getTotalRevenue()).toBe(3.0);
    });

    it('should generate separate invoices per tenant', () => {
        const start = Date.now() - 1000;
        const end = Date.now() + 1000;

        billing.record('t1', 'api_calls', 100);
        billing.record('t2', 'api_calls', 200);

        billing.generateInvoice('t1', start, end);
        billing.generateInvoice('t2', start, end);

        expect(billing.getInvoices('t1')).toHaveLength(1);
        expect(billing.getInvoices('t2')).toHaveLength(1);
        expect(billing.getInvoices('t1')[0]!.totalAmount).not.toBe(billing.getInvoices('t2')[0]!.totalAmount);
    });

    it('should handle zero-usage invoice', () => {
        const inv = billing.generateInvoice('empty-tenant', 0, Date.now() + 1000);
        expect(inv.lineItems).toHaveLength(0);
        expect(inv.totalAmount).toBe(0);
        expect(inv.currency).toBe('USD');
    });

    it('should maintain decimal precision without floating point drift', () => {
        billing.setPrice('micro_ops', 0.0001);
        const start = Date.now() - 1000;
        // 10000 * 0.0001 = 1.0 exactly
        billing.record('t1', 'micro_ops', 10000);
        const inv = billing.generateInvoice('t1', start, Date.now() + 1000);
        expect(inv.totalAmount).toBe(1.0);
    });
});
