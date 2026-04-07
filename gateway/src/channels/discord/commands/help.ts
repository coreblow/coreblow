/**
 * src/channels/discord/commands/help.ts
 */
import type { SlashCommand } from '../types.js';
import type { ChannelStatus } from '../../interface.js';
import { RichResponse } from '../components/rich-response.js';
import { createHelpEmbed } from '../embeds/help.js';

interface DiscordChannelRef {
 getStatus(): ChannelStatus;
 getAllSlashCommands(): SlashCommand[];
}

export function helpCommand(channel: DiscordChannelRef): SlashCommand {
 return {
 name: 'help',
 description: 'Show all available commands',
 handler: async () => new RichResponse().embed(createHelpEmbed(channel.getAllSlashCommands())),
 };
}
