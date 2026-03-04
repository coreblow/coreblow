/**
 * src/channels/slack.ts
 * Slack channel adapter — Socket Mode + Web API
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:slack');

export class SlackChannel implements ChannelAdapter {
    name = 'slack';
    private app: any = null;
    private botToken: string;
    private appToken: string;
    private connected = false;
    private startedAt = 0;
    private router?: MessageRouter;

    constructor(botToken: string, appToken: string) {
        this.botToken = botToken;
        this.appToken = appToken;
    }

    async start(router: MessageRouter) {
        this.router = router;

        try {
            // Dynamic import @slack/bolt (optional dependency)
            const { App } = await import('@slack/bolt');

            this.app = new App({
                token: this.botToken,
                appToken: this.appToken,
                socketMode: true,
            });

            // Handle messages
            this.app.message(async ({ message, say }: any) => {
                // Skip bot messages and edited messages
                if (message.subtype || message.bot_id) return;

                const text = message.text || '';
                if (!text.trim()) return;

                const isChannel = message.channel_type === 'channel' || message.channel_type === 'group';

                const inbound = {
                    channel: 'slack' as const,
                    senderId: message.user,
                    senderName: message.user,  // Will be resolved via Slack API if needed
                    sessionId: MessageRouter.deriveSessionId(
                        'slack',
                        message.user,
                        isChannel ? message.channel : undefined
                    ),
                    groupId: isChannel ? message.channel : undefined,
                    text,
                    timestamp: Date.now(),
                    raw: message,
                };

                await router.routeInbound(inbound);
            });

            // Handle app mentions in channels
            this.app.event('app_mention', async ({ event, say }: any) => {
                const text = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
                if (!text) return;

                const inbound = {
                    channel: 'slack' as const,
                    senderId: event.user,
                    senderName: event.user,
                    sessionId: MessageRouter.deriveSessionId('slack', event.user, event.channel),
                    groupId: event.channel,
                    text,
                    timestamp: Date.now(),
                    raw: event,
                };

                await router.routeInbound(inbound);
            });

            // Register sender
            router.registerChannelSender('slack', async (msg) => {
                const channelId = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 3000);

                for (const chunk of chunks) {
                    try {
                        await this.app.client.chat.postMessage({
                            token: this.botToken,
                            channel: channelId,
                            text: chunk,
                            mrkdwn: true,
                        });
                    } catch (err: any) {
                        log.error({ err: err.message, channel: channelId }, 'Failed to send Slack message');
                    }
                }
            });

            // Start Socket Mode
            await this.app.start();
            this.connected = true;
            this.startedAt = Date.now();
            log.info('Slack bot started (Socket Mode)');
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Slack channel');
            throw err;
        }
    }

    async stop() {
        if (this.app) {
            await this.app.stop();
            this.connected = false;
            log.info('Slack bot stopped');
        }
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'slack',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
        };
    }
}
