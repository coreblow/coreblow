/**
 * src/channels/discord/events/threadCreate.ts
 */
import type { EventContext } from './index.js';
import type { DiscordThread } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export async function onThreadCreate(thread: DiscordThread & { joinable?: boolean; joined?: boolean; join?: () => Promise<void> }, ctx: EventContext): Promise<void> {
 try {
 if (thread.joinable && !thread.joined) {
  await thread.join?.();
  discordLog.debug({ threadId: thread.id, name: thread.name }, 'Auto-joined thread');
 }
 } catch (err: unknown) {
 discordLog.debug({ err: (err instanceof Error ? err.message : String(err)) }, 'Failed to join thread');
 }
}
