/**
 * src/channels/discord/events/guildMemberAdd.ts
 */
import type { EventContext } from './index.js';
import type { DiscordMember } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export function onGuildMemberAdd(member: DiscordMember & { guild?: { name: string } }, ctx: EventContext): void {
 discordLog.debug({ userId: member.user?.id, guild: member.guild?.name }, 'Member joined');
}
