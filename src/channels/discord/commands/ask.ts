/**
 * src/channels/discord/commands/ask.ts
 */
import type { SlashCommand } from '../types.js';
import type { ChannelStatus } from '../../interface.js';
import { RichResponse } from '../components/rich-response.js';
import { PROVIDER_COLORS } from '../constants.js';

interface DiscordChannelRef {
 getStatus(): ChannelStatus;
 getAllSlashCommands(): SlashCommand[];
}

export function askCommand(_channel: DiscordChannelRef): SlashCommand {
 return {
 name: 'ask',
 description: 'Ask the AI a question',
 options: [{ name: 'question', description: 'Your question or prompt', type: 3, required: true }],
 handler: async (interaction) => {
  const question = interaction.options?.getString?.('question') || '';
  return new RichResponse().embed({ title: ' Processing...', description: question, color: PROVIDER_COLORS.default, footer: { text: 'Waiting for AI response...' } });
 },
 };
}
