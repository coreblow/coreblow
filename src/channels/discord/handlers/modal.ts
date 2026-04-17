/**
 * src/channels/discord/handlers/modal.ts
 */
import { MessageRouter } from '../../../gateway/router.js';
import type { ChannelStats } from '../types.js';
import type { DiscordInteraction } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export async function handleModal(
 interaction: DiscordInteraction & { channel?: { id: string }; user: { id: string; displayName?: string; username?: string }; fields?: { fields?: Map<string, { value?: string }> } },
 router: MessageRouter,
 stats: ChannelStats,
): Promise<void> {
 stats.componentsHandled++;
 stats.modalsOpened++;
 const customId = interaction.customId || '';
 const fields: Record<string, string> = {};
 if (interaction.fields?.fields) {
 for (const [key, field] of interaction.fields.fields) {
  fields[key] = field.value || '';
 }
 }
 discordLog.debug({ customId, fieldCount: Object.keys(fields).length }, 'Modal submitted');

 const inbound = {
 channel: 'discord' as const,
 senderId: interaction.user.id,
 senderName: interaction.user.displayName || interaction.user.username || '',
 sessionId: MessageRouter.deriveSessionId('discord', interaction.user.id, interaction.channel?.id),
 groupId: interaction.channel?.id,
 text: `[modal:${customId}:${JSON.stringify(fields)}]`,
 timestamp: Date.now(),
 raw: interaction as unknown as Record<string, unknown>,
 metadata: { customId, fields } as Record<string, unknown>,
 };
 await router.routeInbound(inbound);
}
