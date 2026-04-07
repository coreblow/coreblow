/**
 * Googlechat Message Handler
 */
import type { GooglechatMessage } from './types';

export class GooglechatHandler {
  async onMessage(message: GooglechatMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
