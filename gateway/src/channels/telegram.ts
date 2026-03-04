/**
 * src/channels/telegram.ts
 * Telegram channel adapter using grammY
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:telegram');

export class TelegramChannel implements ChannelAdapter {
    name = 'telegram';
    private bot: any = null;
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
            // Dynamic import grammY (optional dependency)
            const { Bot } = await import('grammy');
            this.bot = new Bot(this.token);

            // Handle text messages
            this.bot.on('message:text', async (ctx: any) => {
                const msg = ctx.message;
                const chatId = msg.chat.id.toString();
                const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

                // In groups, only respond to mentions or replies
                if (isGroup) {
                    const botInfo = ctx.me;
                    const mentioned = msg.text?.includes(`@${botInfo.username}`);
                    const isReply = msg.reply_to_message?.from?.id === botInfo.id;
                    if (!mentioned && !isReply) return;
                }

                const text = msg.text
                    ?.replace(new RegExp(`@${ctx.me.username}`, 'g'), '')
                    .trim() || '';

                if (!text) return;

                const inbound = {
                    channel: 'telegram' as const,
                    senderId: msg.from.id.toString(),
                    senderName: msg.from.first_name || msg.from.username || 'User',
                    sessionId: MessageRouter.deriveSessionId(
                        'telegram',
                        msg.from.id.toString(),
                        isGroup ? chatId : undefined
                    ),
                    groupId: isGroup ? chatId : undefined,
                    text,
                    timestamp: Date.now(),
                    raw: msg,
                };

                // Show typing indicator
                await ctx.replyWithChatAction('typing');

                await router.routeInbound(inbound);
            });

            // Register sender
            router.registerChannelSender('telegram', async (msg) => {
                const chatId = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 4000);

                for (const chunk of chunks) {
                    try {
                        await this.bot.api.sendMessage(chatId, chunk, {
                            parse_mode: 'Markdown',
                        });
                    } catch {
                        // Retry without markdown if parsing fails
                        await this.bot.api.sendMessage(chatId, chunk);
                    }
                }
            });

            // Start polling
            this.bot.start({
                onStart: () => {
                    this.connected = true;
                    this.startedAt = Date.now();
                    log.info('Telegram bot started (polling)');
                },
            });

            // Handle errors
            this.bot.catch((err: any) => {
                log.error({ err: err.message }, 'Telegram bot error');
            });
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Telegram channel');
            throw err;
        }
    }

    async stop() {
        if (this.bot) {
            await this.bot.stop();
            this.connected = false;
            log.info('Telegram bot stopped');
        }
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'telegram',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
        };
    }
}
