/**
 * src/channels/discord/commands/clear.ts
 */
import type { SlashCommand } from '../types.js';
import { RichResponse } from '../components/rich-response.js';

export function clearCommand(_channel: unknown): SlashCommand {
 return {
 name: 'clear',
 description: 'Clear conversation history',
 handler: async (interaction) => {
 const userId = interaction.user?.id || 'unknown';
 return new RichResponse()
 .quickEmbed(' History Cleared', `Conversation history for <@${userId}> has been cleared.`, 0xF59E0B)
 .buttons([{ label: 'Start New Chat', customId: 'new_chat', style: 'success', emoji: '' }])
 .ephemeral();
 },
 };
}
