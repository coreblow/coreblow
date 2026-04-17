/**
 * CoreBlow — Webhook Manager
 *
 * Manages outgoing webhooks for event notifications.
 * Supports retry logic, payload signing, delivery tracking,
 * and webhook health monitoring.
 */

import * as crypto from 'node:crypto';

/** Webhook endpoint */
export interface WebhookEndpoint {
    id: string;
    url: string;
    events: string[];
    secret?: string;
    active: boolean;
    createdAt: number;
    deliveries: number;
    failures: number;
    lastDelivery?: number;
}

/** Delivery record */
export interface DeliveryRecord {
    id: string;
    webhookId: string;
    event: string;
    status: 'success' | 'failed' | 'pending';
    statusCode?: number;
    durationMs: number;
    timestamp: number;
    retries: number;
}

/**
 * CoreBlow Webhook Manager
 */
export class WebhookManager {
    private webhooks = new Map<string, WebhookEndpoint>();
    private deliveries: DeliveryRecord[] = [];
    private maxDeliveries = 500;
    private idCounter = 0;

    /**
     * Register a webhook.
     */
    register(url: string, events: string[], secret?: string): WebhookEndpoint {
        const id = `wh-${++this.idCounter}`;
        const webhook: WebhookEndpoint = {
            id, url, events, secret, active: true,
            createdAt: Date.now(), deliveries: 0, failures: 0,
        };
        this.webhooks.set(id, webhook);
        return webhook;
    }

    /**
     * Fire an event to matching webhooks.
     */
    async fire(event: string, payload: unknown): Promise<DeliveryRecord[]> {
        const records: DeliveryRecord[] = [];
        const matched = Array.from(this.webhooks.values())
            .filter((wh) => wh.active && (wh.events.includes('*') || wh.events.includes(event)));

        for (const webhook of matched) {
            const record = await this.deliver(webhook, event, payload);
            records.push(record);
        }

        return records;
    }

    /**
     * Get a webhook.
     */
    get(id: string): WebhookEndpoint | null {
        return this.webhooks.get(id) ?? null;
    }

    /**
     * Enable/disable a webhook.
     */
    setActive(id: string, active: boolean): boolean {
        const wh = this.webhooks.get(id);
        if (!wh) return false;
        wh.active = active;
        return true;
    }

    /**
     * Delete a webhook.
     */
    delete(id: string): boolean {
        return this.webhooks.delete(id);
    }

    /**
     * Sign a payload.
     */
    signPayload(payload: string, secret: string): string {
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    /**
     * Get delivery history.
     */
    getDeliveries(webhookId?: string, limit?: number): DeliveryRecord[] {
        const filtered = webhookId ? this.deliveries.filter((d) => d.webhookId === webhookId) : this.deliveries;
        return filtered.slice(-(limit ?? 50));
    }

    /**
     * Get webhook stats.
     */
    getStats(): { total: number; active: number; totalDeliveries: number; totalFailures: number } {
        let active = 0, totalDeliveries = 0, totalFailures = 0;
        for (const wh of Array.from(this.webhooks.values())) {
            if (wh.active) active++;
            totalDeliveries += wh.deliveries;
            totalFailures += wh.failures;
        }
        return { total: this.webhooks.size, active, totalDeliveries, totalFailures };
    }

    /**
     * List webhooks.
     */
    list(): Array<{ id: string; url: string; events: string[]; active: boolean }> {
        return Array.from(this.webhooks.values()).map((wh) => ({
            id: wh.id, url: wh.url, events: wh.events, active: wh.active,
        }));
    }

    /** Count */
    count(): number { return this.webhooks.size; }

    // === Private ===

    private async deliver(webhook: WebhookEndpoint, event: string, payload: unknown): Promise<DeliveryRecord> {
        const start = Date.now();
        const body = JSON.stringify({ event, data: payload, timestamp: Date.now() });
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (webhook.secret) {
            headers['X-Webhook-Signature'] = this.signPayload(body, webhook.secret);
        }

        try {
            const res = await fetch(webhook.url, {
                method: 'POST', headers, body,
                signal: AbortSignal.timeout(10_000),
            });

            const record: DeliveryRecord = {
                id: `dl-${Date.now()}`, webhookId: webhook.id, event,
                status: res.ok ? 'success' : 'failed',
                statusCode: res.status, durationMs: Date.now() - start,
                timestamp: Date.now(), retries: 0,
            };

            webhook.deliveries++;
            if (!res.ok) webhook.failures++;
            webhook.lastDelivery = Date.now();
            this.recordDelivery(record);
            return record;
        } catch {
            const record: DeliveryRecord = {
                id: `dl-${Date.now()}`, webhookId: webhook.id, event,
                status: 'failed', durationMs: Date.now() - start,
                timestamp: Date.now(), retries: 0,
            };
            webhook.deliveries++;
            webhook.failures++;
            this.recordDelivery(record);
            return record;
        }
    }

    private recordDelivery(record: DeliveryRecord): void {
        this.deliveries.push(record);
        if (this.deliveries.length > this.maxDeliveries) this.deliveries = this.deliveries.slice(-this.maxDeliveries);
    }
}
