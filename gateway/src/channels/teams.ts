/**
 * src/channels/teams.ts
 * Microsoft Teams channel adapter — Bot Framework via HTTP webhook
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:teams');

export interface TeamsConfig {
    appId: string;
    appPassword: string;
    webhookPort?: number;
}

export class TeamsChannel implements ChannelAdapter {
    name = 'teams';
    private config: TeamsConfig;
    private connected = false;
    private startedAt = 0;
    private server: any = null;
    private accessToken: string = '';
    private tokenExpiry: number = 0;

    constructor(config: TeamsConfig) {
        this.config = config;
    }

    async start(router: MessageRouter) {
        try {
            const http = await import('node:http');
            const port = this.config.webhookPort || 3160;

            this.server = http.createServer(async (req, res) => {
                if (req.method !== 'POST' || req.url !== '/api/messages') {
                    res.writeHead(404);
                    res.end();
                    return;
                }

                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const body = JSON.parse(Buffer.concat(chunks).toString());

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{}');

                // Process Bot Framework activity
                if (body.type !== 'message' || !body.text) return;

                const inbound = {
                    channel: 'teams' as const,
                    senderId: body.from?.id || 'unknown',
                    senderName: body.from?.name || 'Teams User',
                    sessionId: MessageRouter.deriveSessionId('teams', body.from?.id, body.conversation?.id),
                    groupId: body.conversation?.isGroup ? body.conversation.id : undefined,
                    text: body.text.replace(/<at>.*?<\/at>/g, '').trim(),
                    timestamp: Date.now(),
                    raw: body,
                };

                // Store service URL for replies
                const serviceUrl = body.serviceUrl;
                const conversationId = body.conversation?.id;

                router.registerChannelSender('teams', async (msg) => {
                    const token = await this.getToken();
                    const chunks = chunkMessage(msg.text, 4000);

                    for (const chunk of chunks) {
                        await fetch(`${serviceUrl}/v3/conversations/${conversationId}/activities`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                type: 'message',
                                text: chunk,
                                textFormat: 'markdown',
                            }),
                        });
                    }
                });

                await router.routeInbound(inbound);
            });

            this.server.listen(port, () => {
                this.connected = true;
                this.startedAt = Date.now();
                log.info({ port }, 'Teams webhook started');
            });

        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Teams channel');
            throw err;
        }
    }

    private async getToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

        const res = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.config.appId,
                client_secret: this.config.appPassword,
                scope: 'https://api.botframework.com/.default',
            }),
        });

        const data = await res.json() as any;
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken;
    }

    async stop() {
        if (this.server) { this.server.close(); this.connected = false; }
    }

    isConnected() { return this.connected; }

    getStatus(): ChannelStatus {
        return { name: 'teams', connected: this.connected, uptime: this.connected ? Date.now() - this.startedAt : 0 };
    }
}
