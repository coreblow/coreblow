/**
 * src/channels/discord/events/reactionAdd.ts
 */
import type { EventContext } from './index.js';
import type { DiscordReaction, DiscordUser } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export function onReactionAdd(reaction: DiscordReaction, user: DiscordUser, ctx: EventContext): void {
 if (user.bot) return;
 ctx.stats.reactionCount++;
 discordLog.debug({ emoji: reaction.emoji.name, user: user.id }, 'Reaction added');
}
