/**
 * src/channels/discord/events/interactionCreate.ts
 */
import type { EventContext } from './index.js';
import type { DiscordInteraction } from '../types-sdk.js';
import { handleCommand } from '../handlers/command.js';
import { handleButton } from '../handlers/button.js';
import { handleSelectMenu } from '../handlers/select-menu.js';
import { handleModal } from '../handlers/modal.js';
import { handleAutocomplete } from '../handlers/autocomplete.js';

export async function onInteractionCreate(interaction: DiscordInteraction, ctx: EventContext): Promise<void> {
 if (interaction.isCommand?.()) {
 await handleCommand(interaction, ctx.commands, ctx.stats, ctx.config.richResponses, ctx.paginationState);
 } else if (interaction.isButton?.()) {
 await handleButton(interaction, ctx.router, ctx.stats, ctx.paginationState);
 } else if (interaction.isStringSelectMenu?.()) {
 await handleSelectMenu(interaction, ctx.router, ctx.stats);
 } else if (interaction.isModalSubmit?.()) {
 await handleModal(interaction, ctx.router, ctx.stats);
 } else if ((interaction as unknown as { isAutocomplete?: () => boolean }).isAutocomplete?.()) {
 await handleAutocomplete(interaction);
 }
}
