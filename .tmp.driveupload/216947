/**
 * src/channels/discord/events/error.ts
 */
import type { EventContext } from './index.js';
import { discordLog } from '../utils/logger.js';

export function onError(err: Error, ctx: EventContext): void {
 discordLog.error({ err: err?.message || String(err) }, 'Discord client error');
}
