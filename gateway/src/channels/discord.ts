/**
 * src/channels/discord.ts
 * Discord channel adapter using discord.js
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:discord');

export class DiscordChannel implements ChannelAdapter {
    name = 'discord';
    private client: any = null;
    private token: string;
    private connected = false;
    private startedAt = 0;
    private router?: MessageRouter;

    constructor(token: string) {
        this.token = token;
    }

    async start(router: MessageRouter) {
        this.router = router;

        try {
            // Dynamic import discord.js (optional dependency)
            const { Client, GatewayIntentBits } = await import('discord.js');

            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                    GatewayIntentBits.DirectMessages,
                ],
            });

            this.client.on('ready', () => {
                this.connected = true;
                this.startedAt = Date.now();
                log.info({ tag: this.client.user?.tag }, 'Discord bot ready');
            });

            this.client.on('messageCreate', async (message: any) => {
                // Ignore own messages
                if (message.author.bot) return;

                const isGuild = !!message.guild;
                const isDM = !isGuild;

                // In guilds, only respond to mentions
                if (isGuild) {
                    const mentioned = message.mentions.has(this.client.user);
                    if (!mentioned) return;
                }

                const text = message.content
                    .replace(/<@!?\d+>/g, '')
                    .trim();

                if (!text) return;

                const inbound = {
                    channel: 'discord' as const,
                    senderId: message.author.id,
                    senderName: message.author.displayName || message.author.username,
                    sessionId: MessageRouter.deriveSessionId(
                        'discord',
                        message.author.id,
                        isGuild ? message.channel.id : undefined
                    ),
                    groupId: isGuild ? message.channel.id : undefined,
                    text,
                    timestamp: Date.now(),
                    raw: message,
                };

                // Show typing indicator
                message.channel.sendTyping();

                await router.routeInbound(inbound);
            });

            // Register sender
            router.registerChannelSender('discord', async (msg) => {
                const channelId = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 2000);

                try {
                    // Try finding the channel
                    let channel = this.client.channels.cache.get(channelId);
                    if (!channel) {
                        channel = await this.client.channels.fetch(channelId).catch(() => null);
                    }

                    // If it's a DM, create or fetch DM channel
                    if (!channel) {
                        const user = await this.client.users.fetch(msg.senderId).catch(() => null);
                        if (user) channel = await user.createDM();
                    }

                    if (channel && 'send' in channel) {
                        for (const chunk of chunks) {
                            await channel.send(chunk);
                        }
                    }
                } catch (err: any) {
                    log.error({ err: err.message, channelId }, 'Failed to send Discord message');
                }
            });

            // Handle errors
            this.client.on('error', (err: any) => {
                log.error({ err: err.message }, 'Discord client error');
            });

            await this.client.login(this.token);
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Discord channel');
            throw err;
        }
    }

    async stop() {
        if (this.client) {
            this.client.destroy();
            this.connected = false;
            log.info('Discord bot stopped');
        }
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'discord',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
            details: {
                tag: this.client?.user?.tag,
                guilds: this.client?.guilds?.cache?.size || 0,
            },
        };
    }
}
