/**
 * src/channels/discord/events/reactionRemove.ts
 */
import type { EventContext } from './index.js';
import type { DiscordReaction, DiscordUser } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export function onReactionRemove(reaction: DiscordReaction, user: DiscordUser, ctx: EventContext): void {
 if (user.bot) return;
 discordLog.debug({ emoji: reaction.emoji.name, user: user.id }, 'Reaction removed');
}
