/**
 * src/channels/discord/embeds/help.ts
 */
import type { DiscordEmbed } from '../types.js';
import type { SlashCommand } from '../types.js';
import { PROVIDER_COLORS } from '../constants.js';

export function createHelpEmbed(commands: SlashCommand[]): DiscordEmbed {
 const desc = commands.map(c => `**/${c.name}** — ${c.description}`).join('\n');
 return { title: ' CoreBlow Commands', description: desc || 'No commands registered', color: PROVIDER_COLORS.default, footer: { text: 'Type / to see all commands' } };
}
