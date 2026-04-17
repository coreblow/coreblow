/**
 * src/channels/discord/threads/create.ts
 */
import type { DiscordTextChannel } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export async function createThread(channel: DiscordTextChannel & { threads?: { create(opts: Record<string, unknown>): Promise<{ id: string }> } }, name: string, messageId?: string): Promise<string | null> {
 try {
 if (!channel.threads) return null;
 const thread = messageId
  ? await channel.threads.create({ startMessage: messageId, name, autoArchiveDuration: 60 })
  : await channel.threads.create({ name, autoArchiveDuration: 60 });
 discordLog.debug({ threadId: thread.id, name }, 'Thread created');
 return thread.id;
 } catch (err: unknown) {
 discordLog.error({ err: (err instanceof Error ? err.message : String(err)) }, 'Failed to create thread');
 return null;
 }
}
