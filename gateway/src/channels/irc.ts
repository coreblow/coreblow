/**
 * src/channels/irc.ts
 * IRC channel adapter — connects to IRC servers via irc-framework
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:irc');

export interface IRCConfig {
    server: string;
    port?: number;
    nick: string;
    channels: string[];       // e.g. ['#general', '#ai']
    tls?: boolean;
    password?: string;
}

export class IRCChannel implements ChannelAdapter {
    name = 'irc';
    private client: any = null;
    private config: IRCConfig;
    private connected = false;
    private startedAt = 0;

    constructor(config: IRCConfig) {
        this.config = config;
    }

    async start(router: MessageRouter) {
        try {
            const { Client } = await import('irc-framework');
            this.client = new Client();

            this.client.connect({
                host: this.config.server,
                port: this.config.port || (this.config.tls ? 6697 : 6667),
                nick: this.config.nick,
                tls: this.config.tls || false,
                password: this.config.password,
            });

            this.client.on('registered', () => {
                this.connected = true;
                this.startedAt = Date.now();
                log.info({ server: this.config.server, nick: this.config.nick }, 'IRC connected');

                for (const ch of this.config.channels) {
                    this.client.join(ch);
                    log.info({ channel: ch }, 'Joined IRC channel');
                }
            });

            // Handle channel messages
            this.client.on('privmsg', (event: any) => {
                const text = event.message || '';
                if (!text.trim()) return;

                const isChannel = event.target.startsWith('#');
                // In channels, only respond to mentions
                if (isChannel && !text.toLowerCase().includes(this.config.nick.toLowerCase())) return;

                const cleanText = text.replace(new RegExp(this.config.nick + '[:\\s]*', 'i'), '').trim();

                const inbound = {
                    channel: 'irc' as const,
                    senderId: event.nick,
                    senderName: event.nick,
                    sessionId: MessageRouter.deriveSessionId('irc', event.nick, isChannel ? event.target : undefined),
                    groupId: isChannel ? event.target : undefined,
                    text: cleanText || text,
                    timestamp: Date.now(),
                };

                router.routeInbound(inbound);
            });

            // Register sender
            router.registerChannelSender('irc', async (msg) => {
                const target = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 400);  // IRC line limit
                for (const chunk of chunks) {
                    this.client.say(target, chunk);
                }
            });

            this.client.on('close', () => {
                this.connected = false;
                log.warn('IRC disconnected');
                // Auto-reconnect after 10s
                setTimeout(() => {
                    if (!this.connected) {
                        log.info('IRC auto-reconnecting...');
                        this.client.connect();
                    }
                }, 10000);
            });

        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start IRC channel');
            throw err;
        }
    }

    async stop() {
        if (this.client) {
            this.client.quit('CoreBlow shutting down');
            this.connected = false;
        }
    }

    isConnected() { return this.connected; }

    getStatus(): ChannelStatus {
        return { name: 'irc', connected: this.connected, uptime: this.connected ? Date.now() - this.startedAt : 0 };
    }
}
