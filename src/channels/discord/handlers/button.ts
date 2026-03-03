/**
 * src/channels/discord/handlers/button.ts
 * Button click handler including pagination
 */

import { clamp } from "../../../utils.js";
import { MessageRouter } from '../../../gateway/router.js';
import type { ChannelStats } from '../types.js';
import type { DiscordInteraction, PaginationState, PaginationButton } from '../types-sdk.js';
import { isPaginationButton, getPaginationDirection, getPaginationSessionId, paginationButtons } from '../components/pagination.js';
import { BUTTON_STYLES } from '../constants.js';
import { discordLog } from '../utils/logger.js';

export async function handleButton(
 interaction: DiscordInteraction & { update?: (payload: unknown) => Promise<void>; channel?: { id: string }; user: { id: string; displayName?: string; username?: string } },
 router: MessageRouter,
 stats: ChannelStats,
 paginationState: Map<string, PaginationState>,
): Promise<void> {
 stats.componentsHandled++;
 const customId = interaction.customId || '';

 if (isPaginationButton(customId)) {
 const sessionId = getPaginationSessionId(customId);
 const state = paginationState.get(sessionId);
 if (state) {
  const direction = getPaginationDirection(customId);
  state.page = clamp(state.response.pageCount - 1, 0, state.page + (direction === 'next' ? 1 : direction === 'prev' ? -1 : 0));
  const payload = state.response.toPayload() as Record<string, unknown>;
  const embeds = payload.embeds as Array<Record<string, unknown>> | undefined;
  if (embeds?.[0]) embeds[0].description = state.response.getPage(state.page);
  const pgButtons = state.response.paginationButtons(state.page, sessionId);
  const pgRow = {
  type: 1,
  components: pgButtons.map((b: PaginationButton) => ({
   type: 2, label: b.label, style: BUTTON_STYLES.SECONDARY, custom_id: b.customId, disabled: b.disabled ?? false,
  })),
  };
  const components = (payload.components || []) as Array<Record<string, unknown>>;
  payload.components = components.filter((c: Record<string, unknown>) =>
  !(c.components as Array<Record<string, unknown>> | undefined)?.some((b: Record<string, unknown>) => (b.custom_id as string)?.startsWith('page_'))
  );
  (payload.components as Array<Record<string, unknown>>).push(pgRow);
  await interaction.update?.(payload).catch(() => { });
  return;
 }
 }

 stats.reactionCount++;
 const inbound = {
 channel: 'discord' as const,
 senderId: interaction.user.id,
 senderName: interaction.user.displayName || interaction.user.username || '',
 sessionId: MessageRouter.deriveSessionId('discord', interaction.user.id, interaction.channel?.id),
 groupId: interaction.channel?.id,
 text: `[button:${customId}]`,
 timestamp: Date.now(),
 raw: interaction as unknown as Record<string, unknown>,
 };
 await router.routeInbound(inbound);
}
