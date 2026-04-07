/**
 * Twitch Message Handler
 */
import type { TwitchMessage } from './types';

export class TwitchHandler {
  async onMessage(message: TwitchMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
