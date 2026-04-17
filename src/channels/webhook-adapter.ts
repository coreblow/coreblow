/**
 * CoreBlow — Generic Webhook Adapter
 *
 * Universal webhook adapter for custom integrations.
 * Accepts incoming webhooks and forwards outbound messages
 * via configurable HTTP endpoints. Great for custom bots,
 * internal tools, and third-party integrations.
 */

import * as crypto from 'node:crypto';

/** Webhook configuration */
export interface WebhookConfig {
    id: string;
    name: string;
    /** URL to send outbound messages to */
    outboundUrl: string;
    /** Secret for HMAC signature verification */
    secret?: string;
    /** Signature header name */
    signatureHeader?: string;
    /** Custom headers for outbound requests */
    headers?: Record<string, string>;
    /** Transform inbound payload to standard format */
    inboundTransform?: (payload: unknown) => WebhookInboundMessage;
}

/** Standardized inbound message from webhook */
export interface WebhookInboundMessage {
    id: string;
    senderId: string;
    senderName?: string;
    channelId: string;
    text: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** Outbound message */
export interface WebhookOutboundMessage {
    channelId: string;
    text: string;
    metadata?: Record<string, unknown>;
}

/** Message handler */
export type WebhookMessageHandler = (msg: WebhookInboundMessage) => Promise<string | void>;

/**
 * CoreBlow Webhook Adapter
 */
export class WebhookAdapter {
    private webhooks = new Map<string, WebhookConfig>();
    private messageHandler: WebhookMessageHandler | null = null;
    private deliveryLog: Array<{ webhookId: string; messageId: string; status: number; timestamp: number }> = [];

    /**
     * Register a webhook configuration.
     */
    register(config: WebhookConfig): void {
        this.webhooks.set(config.id, config);
    }

    /**
     * Remove a webhook.
     */
    unregister(id: string): boolean {
        return this.webhooks.delete(id);
    }

    onMessage(handler: WebhookMessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Process an inbound webhook payload.
     */
    async processInbound(webhookId: string, payload: unknown, signature?: string): Promise<WebhookInboundMessage | null> {
        const config = this.webhooks.get(webhookId);
        if (!config) return null;

        // Verify signature
        if (config.secret && signature) {
            const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
            if (!this.verifySignature(payloadStr, signature, config.secret)) {
                throw new Error('Invalid webhook signature');
            }
        }

        // Transform payload
        const message = config.inboundTransform
            ? config.inboundTransform(payload)
            : this.defaultTransform(webhookId, payload);

        // Handle
        if (this.messageHandler) {
            await this.messageHandler(message);
        }

        return message;
    }

    /**
     * Send an outbound message via webhook.
     */
    async sendOutbound(webhookId: string, message: WebhookOutboundMessage): Promise<boolean> {
        const config = this.webhooks.get(webhookId);
        if (!config) return false;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...config.headers,
        };

        // Add HMAC signature
        if (config.secret) {
            const body = JSON.stringify(message);
            const hmac = crypto.createHmac('sha256', config.secret).update(body).digest('hex');
            headers[config.signatureHeader ?? 'X-Webhook-Signature'] = `sha256=${hmac}`;
        }

        try {
            const res = await fetch(config.outboundUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(message),
            });

            this.deliveryLog.push({
                webhookId,
                messageId: `msg-${Date.now()}`,
                status: res.status,
                timestamp: Date.now(),
            });

            return res.ok;
        } catch {
            this.deliveryLog.push({
                webhookId,
                messageId: `msg-${Date.now()}`,
                status: 0,
                timestamp: Date.now(),
            });
            return false;
        }
    }

    /**
     * List registered webhooks.
     */
    list(): Array<{ id: string; name: string; outboundUrl: string }> {
        return Array.from(this.webhooks.values()).map((w) => ({
            id: w.id,
            name: w.name,
            outboundUrl: w.outboundUrl,
        }));
    }

    /**
     * Get delivery log.
     */
    getDeliveryLog(limit: number = 50): typeof this.deliveryLog {
        return this.deliveryLog.slice(-limit);
    }

    // === Private ===

    private verifySignature(payload: string, signature: string, secret: string): boolean {
        const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
        try {
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch {
            return false;
        }
    }

    private defaultTransform(webhookId: string, payload: unknown): WebhookInboundMessage {
        const data = payload as Record<string, unknown>;
        return {
            id: String(data.id ?? `wh-${Date.now()}`),
            senderId: String(data.sender ?? data.user ?? 'unknown'),
            senderName: data.sender_name as string | undefined,
            channelId: String(data.channel ?? webhookId),
            text: String(data.text ?? data.message ?? data.content ?? ''),
            timestamp: Date.now(),
            metadata: data,
        };
    }
}
