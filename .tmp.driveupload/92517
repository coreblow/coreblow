/**
 * src/channels/discord/commands/status.ts
 */
import type { SlashCommand } from '../types.js';
import type { ChannelStatus } from '../../interface.js';
import { RichResponse } from '../components/rich-response.js';
import { createStatusEmbed } from '../embeds/status.js';

interface DiscordChannelRef {
 getStatus(): ChannelStatus;
 getAllSlashCommands(): SlashCommand[];
}

export function statusCommand(channel: DiscordChannelRef): SlashCommand {
 return {
 name: 'status',
 description: 'Show CoreBlow gateway status',
 handler: async () => new RichResponse().embed(createStatusEmbed(channel.getStatus())),
 };
}
