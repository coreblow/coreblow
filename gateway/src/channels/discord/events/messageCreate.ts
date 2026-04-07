/**
 * src/channels/discord/events/messageCreate.ts
 */
import type { EventContext } from './index.js';
import type { DiscordMessage } from '../types-sdk.js';
import { handleMessage } from '../handlers/message.js';

export async function onMessageCreate(message: DiscordMessage, ctx: EventContext): Promise<void> {
 await handleMessage(message as Parameters<typeof handleMessage>[0], ctx.client, ctx.config, ctx.router, ctx.stats);
}
