/**
 * src/channels/discord/events/voiceStateUpdate.ts
 */
import type { EventContext } from './index.js';
import type { DiscordVoiceState } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

export function onVoiceStateUpdate(oldState: DiscordVoiceState, newState: DiscordVoiceState, ctx: EventContext): void {
 if (newState.member?.user?.bot) return;
 const userId = newState.member?.user?.id;
 const joined = !oldState.channelId && newState.channelId;
 const left = oldState.channelId && !newState.channelId;
 if (joined) discordLog.debug({ userId, channel: newState.channelId }, 'User joined voice');
 if (left) discordLog.debug({ userId, channel: oldState.channelId }, 'User left voice');
}
