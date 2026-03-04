/**
 * src/channels/line.ts
 * LINE channel adapter — via LINE Messaging API (webhook + push)
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:line');

export interface LINEConfig {
    channelAccessToken: string;
    channelSecret: string;
    webhookPort?: number;
}

export class LINEChannel implements ChannelAdapter {
    name = 'line';
    private config: LINEConfig;
    private connected = false;
    private startedAt = 0;
    private server: any = null;

    constructor(config: LINEConfig) {
        this.config = config;
    }

    async start(router: MessageRouter) {
        try {
            const http = await import('node:http');
            const crypto = await import('node:crypto');

            const port = this.config.webhookPort || 3150;

            this.server = http.createServer(async (req, res) => {
                if (req.method !== 'POST' || req.url !== '/webhook/line') {
                    res.writeHead(404);
                    res.end();
                    return;
                }

                // Read body
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const body = Buffer.concat(chunks).toString();

                // Validate signature
                const signature = req.headers['x-line-signature'] as string;
                const hash = crypto.createHmac('sha256', this.config.channelSecret)
                    .update(body).digest('base64');
                if (signature !== hash) {
                    log.warn('Invalid LINE webhook signature');
                    res.writeHead(403);
                    res.end();
                    return;
                }

                const data = JSON.parse(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{}');

                // Process events
                for (const event of data.events || []) {
                    if (event.type !== 'message' || event.message.type !== 'text') continue;

                    const inbound = {
                        channel: 'line' as const,
                        senderId: event.source.userId,
                        senderName: event.source.userId,
                        sessionId: MessageRouter.deriveSessionId('line', event.source.userId,
                            event.source.groupId || event.source.roomId),
                        groupId: event.source.groupId || event.source.roomId,
                        text: event.message.text,
                        timestamp: event.timestamp || Date.now(),
                        raw: event,
                    };

                    await router.routeInbound(inbound);
                }
            });

            // Register sender (push message API)
            router.registerChannelSender('line', async (msg) => {
                const chunks = chunkMessage(msg.text, 5000);
                for (const chunk of chunks) {
                    const payload = {
                        to: msg.groupId || msg.senderId,
                        messages: [{ type: 'text', text: chunk }],
                    };

                    await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.config.channelAccessToken}`,
                        },
                        body: JSON.stringify(payload),
                    });
                }
            });

            this.server.listen(port, () => {
                this.connected = true;
                this.startedAt = Date.now();
                log.info({ port }, 'LINE webhook server started');
            });

        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start LINE channel');
            throw err;
        }
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.connected = false;
        }
    }

    isConnected() { return this.connected; }

    getStatus(): ChannelStatus {
        return { name: 'line', connected: this.connected, uptime: this.connected ? Date.now() - this.startedAt : 0 };
    }
}
