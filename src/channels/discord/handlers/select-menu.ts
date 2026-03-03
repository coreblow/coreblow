/**
 * src/channels/discord/handlers/select-menu.ts
 */
import { MessageRouter } from '../../../gateway/router.js';
import type { ChannelStats } from '../types.js';
import type { DiscordInteraction } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export async function handleSelectMenu(
 interaction: DiscordInteraction & { channel?: { id: string }; user: { id: string; displayName?: string; username?: string } },
 router: MessageRouter,
 stats: ChannelStats,
): Promise<void> {
 stats.componentsHandled++;
 stats.selectMenusUsed++;
 const customId = interaction.customId || '';
 const values = interaction.values || [];
 discordLog.debug({ customId, values }, 'Select menu interaction');

 const inbound = {
 channel: 'discord' as const,
 senderId: interaction.user.id,
 senderName: interaction.user.displayName || interaction.user.username || '',
 sessionId: MessageRouter.deriveSessionId('discord', interaction.user.id, interaction.channel?.id),
 groupId: interaction.channel?.id,
 text: `[select:${customId}:${values.join(',')}]`,
 timestamp: Date.now(),
 raw: interaction as unknown as Record<string, unknown>,
 metadata: { customId, values } as Record<string, unknown>,
 };
 await router.routeInbound(inbound);
}
