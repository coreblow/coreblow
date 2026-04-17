/**
 * CoreBlow Web — Inbound Webhook Receiver
 *
 * Receives webhook callbacks from messaging platforms (Telegram, LINE,
 * Slack Events API), validates request signatures, normalizes payloads,
 * and routes them to the appropriate channel adapters.
 */

import * as crypto from 'node:crypto';
import * as http from 'node:http';

/** Webhook configuration per channel */
export interface WebhookConfig {
    /** Channel identifier */
    channelId: string;
    /** URL path to listen on (e.g., "/webhook/telegram") */
    path: string;
    /** Secret for signature verification */
    secret?: string;
    /** Signature header name */
    signatureHeader?: string;
    /** Signature algorithm */
    signatureAlgo?: 'sha256' | 'sha1';
}

/** Webhook handler function */
type WebhookHandler = (payload: Record<string, unknown>, channelId: string) => Promise<void> | void;

/**
 * CoreBlow Inbound Webhook Receiver
 */
export class InboundReceiver {
    private webhooks = new Map<string, WebhookConfig>();
    private handler: WebhookHandler | null = null;

    /**
     * Register a webhook endpoint for a channel.
     */
    register(config: WebhookConfig): void {
        this.webhooks.set(config.path, config);
    }

    /**
     * Set the handler for all inbound webhooks.
     */
    onWebhook(handler: WebhookHandler): void {
        this.handler = handler;
    }

    /**
     * Handle an incoming HTTP request.
     * Returns true if the request matched a registered webhook.
     */
    async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const pathname = url.pathname;
        const method = (req.method ?? 'GET').toUpperCase();

        // Only handle POST requests to registered webhook paths
        if (method !== 'POST') return false;

        const config = this.webhooks.get(pathname);
        if (!config) return false;

        try {
            // Read body
            const bodyBuffer = await readBody(req);
            const bodyStr = bodyBuffer.toString('utf-8');

            // Verify signature if configured
            if (config.secret && config.signatureHeader) {
                const signature = req.headers[config.signatureHeader.toLowerCase()] as string | undefined;
                if (!signature || !this.verifySignature(bodyBuffer, signature, config)) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid signature' }));
                    return true;
                }
            }

            // Parse payload
            const payload = JSON.parse(bodyStr) as Record<string, unknown>;

            // Route to handler
            if (this.handler) {
                await this.handler(payload, config.channelId);
            }

            // Respond 200 OK
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return true;
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }));
            return true;
        }
    }

    /**
     * List all registered webhooks.
     */
    listWebhooks(): WebhookConfig[] {
        return Array.from(this.webhooks.values());
    }

    // === Private ===

    private verifySignature(body: Buffer, signature: string, config: WebhookConfig): boolean {
        const algo = config.signatureAlgo ?? 'sha256';
        const expected = crypto.createHmac(algo, config.secret!).update(body).digest('hex');

        // Handle prefixed signatures (e.g., "sha256=abc123")
        const sigValue = signature.includes('=')
            ? signature.split('=').slice(1).join('=')
            : signature;

        try {
            return crypto.timingSafeEqual(
                Buffer.from(expected, 'hex'),
                Buffer.from(sigValue, 'hex'),
            );
        } catch {
            return false;
        }
    }
}

/** Read full request body as a Buffer */
function readBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
