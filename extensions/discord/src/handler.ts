/**
 * Discord Message Handler
 */
import type { DiscordMessage } from './types';

export class DiscordHandler {
  async onMessage(message: DiscordMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
