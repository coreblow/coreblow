/**
 * CoreBlow — Usage Billing
 *
 * Tracks billable usage per tenant with metered
 * billing, invoice generation, and cost calculation.
 */

/** Usage record */
export interface UsageRecord {
    tenantId: string;
    metric: string;
    quantity: number;
    unitPrice: number;
    timestamp: number;
}

/** Invoice */
export interface Invoice {
    id: string;
    tenantId: string;
    period: { from: number; to: number };
    lineItems: Array<{ metric: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
    currency: string;
    createdAt: number;
}

/**
 * CoreBlow Usage Billing
 */
export class UsageBilling {
    private records: UsageRecord[] = [];
    private invoices: Invoice[] = [];
    private pricing = new Map<string, number>();
    private idCounter = 0;

    constructor() {
        // Default pricing per unit
        this.pricing.set('api_calls', 0.001);
        this.pricing.set('tokens', 0.00001);
        this.pricing.set('storage_mb', 0.05);
        this.pricing.set('compute_ms', 0.0001);
    }

    /**
     * Record usage.
     */
    record(tenantId: string, metric: string, quantity: number): void {
        const unitPrice = this.pricing.get(metric) ?? 0;
        this.records.push({ tenantId, metric, quantity, unitPrice, timestamp: Date.now() });
    }

    /**
     * Set pricing.
     */
    setPrice(metric: string, unitPrice: number): void {
        this.pricing.set(metric, unitPrice);
    }

    /**
     * Generate invoice for a tenant.
     */
    generateInvoice(tenantId: string, periodFrom: number, periodTo: number): Invoice {
        const filtered = this.records.filter((r) => r.tenantId === tenantId && r.timestamp >= periodFrom && r.timestamp <= periodTo);

        // Aggregate by metric
        const aggregated = new Map<string, { quantity: number; unitPrice: number }>();
        for (const r of filtered) {
            const existing = aggregated.get(r.metric) ?? { quantity: 0, unitPrice: r.unitPrice };
            existing.quantity += r.quantity;
            aggregated.set(r.metric, existing);
        }

        const lineItems = Array.from(aggregated.entries()).map(([metric, { quantity, unitPrice }]) => ({
            metric, quantity, unitPrice, total: Math.round(quantity * unitPrice * 100) / 100,
        }));

        const invoice: Invoice = {
            id: `inv-${++this.idCounter}`, tenantId,
            period: { from: periodFrom, to: periodTo },
            lineItems, totalAmount: lineItems.reduce((s, i) => s + i.total, 0),
            currency: 'USD', createdAt: Date.now(),
        };
        this.invoices.push(invoice);
        return invoice;
    }

    /**
     * Get current period usage for tenant.
     */
    getCurrentUsage(tenantId: string): Record<string, number> {
        const usage: Record<string, number> = {};
        for (const r of this.records) {
            if (r.tenantId === tenantId) usage[r.metric] = (usage[r.metric] ?? 0) + r.quantity;
        }
        return usage;
    }

    /**
     * Get invoices for tenant.
     */
    getInvoices(tenantId: string): Invoice[] {
        return this.invoices.filter((i) => i.tenantId === tenantId);
    }

    /**
     * Get total revenue.
     */
    getTotalRevenue(): number {
        return this.invoices.reduce((s, i) => s + i.totalAmount, 0);
    }

    /** Count records */
    count(): number { return this.records.length; }
}
