/**
 * src/channels/discord/handlers/message.ts
 * Process inbound messages → route to gateway
 */

import { MessageRouter } from '../../../gateway/router.js';
import type { ResolvedConfig } from '../config.js';
import type { ChannelStats } from '../types.js';
import type { DiscordMessage, DiscordClient } from '../types-sdk.js';
import { checkPermissions } from '../utils/permissions.js';
import { discordLog } from '../utils/logger.js';

interface DiscordAttachment {
 url: string;
 name: string;
 size: number;
 contentType?: string;
}

/**
 * Handle incoming Discord message
 */
export async function handleMessage(
 message: DiscordMessage & { guild?: unknown; mentions: { has(user: unknown): boolean }; member?: { displayName?: string }; attachments?: Map<string, DiscordAttachment>; channel: { id: string; name?: string; isThread?: () => boolean; sendTyping(): Promise<void> } },
 client: DiscordClient,
 config: ResolvedConfig,
 router: MessageRouter,
 stats: ChannelStats,
): Promise<void> {
 if (message.author.bot) return;

 const perm = checkPermissions(message, config);
 if (!perm.allowed) return;

 const isGuild = !!message.guild;
 if (isGuild) {
 const mentioned = message.mentions.has(client.user);
 const isThread = message.channel.isThread?.();
 if (!mentioned && !isThread) return;
 }

 const text = message.content.replace(/<@!?\d+>/g, '').trim();
 if (!text) return;

 stats.messageCount++;

 const attachments: DiscordAttachment[] = [];
 if (message.attachments) {
  for (const [, a] of message.attachments) {
   attachments.push({ url: a.url, name: a.name, size: a.size, contentType: a.contentType });
  }
 }

 const inbound = {
 channel: 'discord' as const,
 senderId: message.author.id,
 senderName: message.member?.displayName || message.author.tag,
 sessionId: MessageRouter.deriveSessionId('discord', message.author.id, isGuild ? message.channel.id : undefined),
 groupId: isGuild ? message.channel.id : undefined,
 text,
 timestamp: Date.now(),
 raw: message as unknown as Record<string, unknown>,
 metadata: {
 attachments, isDM: !isGuild,
 isThread: message.channel.isThread?.() ?? false,
 channelName: message.channel.name,
 } as Record<string, unknown>,
 };

 if (config.thinkingEmoji && isGuild) {
 try { await message.react(config.thinkingEmoji); } catch { /* ignore */ }
 }

 message.channel.sendTyping();
 await router.routeInbound(inbound);
}
