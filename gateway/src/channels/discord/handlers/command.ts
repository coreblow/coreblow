/**
 * src/channels/discord/handlers/command.ts
 * Slash command dispatch and error handling
 */

import type { SlashCommand, ChannelStats } from '../types.js';
import type { DiscordInteraction, PaginationState } from '../types-sdk.js';
import { RichResponse } from '../components/rich-response.js';
import { formatAIResponse } from '../embeds/response.js';
import { discordLog } from '../utils/logger.js';

/**
 * Handle a slash command interaction
 */
export async function handleCommand(
 interaction: DiscordInteraction & { deferred?: boolean; channel?: { id: string }; user: { id: string } },
 commands: Map<string, SlashCommand>,
 stats: ChannelStats,
 richResponses: boolean,
 paginationState: Map<string, PaginationState>,
): Promise<void> {
 const cmd = commands.get(interaction.commandName || '');
 if (!cmd) return;

 try {
 await interaction.deferReply();
 const result = await cmd.handler!(interaction);

 if (result instanceof RichResponse) {
  const payload = result.toPayload();
  await interaction.editReply(payload);
  if (result.pageCount > 1) {
  stats.paginatedResponses++;
  const sid = interaction.user?.id || 'default';
  paginationState.set(sid, { response: result, page: 0 });
  }
 } else if (typeof result === 'string') {
  if (richResponses) {
  const rich = formatAIResponse({ text: result });
  await interaction.editReply(rich.toPayload());
  } else {
  await interaction.editReply(result);
  }
 } else {
  const rich = new RichResponse().embed(result as import('../types.js').DiscordEmbed);
  await interaction.editReply(rich.toPayload());
 }
 } catch (err: unknown) {
 discordLog.error({ err: err instanceof Error ? err.message : String(err), command: interaction.commandName }, 'Slash command error');
 const reply = interaction.deferred ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
 await reply({ content: ` Error: ${err instanceof Error ? err.message : String(err)}`, ephemeral: true }).catch(() => { });
 }
}
