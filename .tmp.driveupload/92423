/**
 * src/channels/discord/events/index.ts
 * Register all event handlers on the Discord client
 */

import type { MessageRouter } from '../../../gateway/router.js';
import type { ResolvedConfig } from '../config.js';
import type { SlashCommand, ChannelStats } from '../types.js';
import type { DiscordClient, DiscordMessage, DiscordInteraction, DiscordReaction, DiscordUser, DiscordThread, DiscordVoiceState, DiscordMember, PaginationState } from '../types-sdk.js';
import { onReady } from './ready.js';
import { onMessageCreate } from './messageCreate.js';
import { onInteractionCreate } from './interactionCreate.js';
import { onReactionAdd } from './reactionAdd.js';
import { onReactionRemove } from './reactionRemove.js';
import { onThreadCreate } from './threadCreate.js';
import { onVoiceStateUpdate } from './voiceStateUpdate.js';
import { onGuildMemberAdd } from './guildMemberAdd.js';
import { onError } from './error.js';

export interface EventContext {
 client: DiscordClient;
 config: ResolvedConfig;
 router: MessageRouter;
 commands: Map<string, SlashCommand>;
 stats: ChannelStats;
 paginationState: Map<string, PaginationState>;
 onConnected: () => void;
}

export function registerAllEvents(ctx: EventContext): void {
 const { client } = ctx;
 client.on('ready', () => onReady(ctx));
 client.on('messageCreate', (msg: unknown) => onMessageCreate(msg as DiscordMessage, ctx));
 client.on('interactionCreate', (int: unknown) => onInteractionCreate(int as DiscordInteraction, ctx));
 client.on('messageReactionAdd', (r: unknown, u: unknown) => onReactionAdd(r as DiscordReaction, u as DiscordUser, ctx));
 client.on('messageReactionRemove', (r: unknown, u: unknown) => onReactionRemove(r as DiscordReaction, u as DiscordUser, ctx));
 client.on('threadCreate', (t: unknown) => onThreadCreate(t as DiscordThread, ctx));
 client.on('voiceStateUpdate', (o: unknown, n: unknown) => onVoiceStateUpdate(o as DiscordVoiceState, n as DiscordVoiceState, ctx));
 client.on('guildMemberAdd', (m: unknown) => onGuildMemberAdd(m as DiscordMember, ctx));
 client.on('error', (err: unknown) => onError(err instanceof Error ? err : new Error(String(err)), ctx));
 client.on('warn', (msg: unknown) => onError(new Error(String(msg)), ctx));
}
