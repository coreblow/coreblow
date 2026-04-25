/**
 * Msteams Message Handler
 */
import type { MsteamsMessage } from './types.js';

export class MsteamsHandler {
  async onMessage(message: MsteamsMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
