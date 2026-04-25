/**
 * Imessage Message Handler
 */
import type { ImessageMessage } from './types.js';

export class ImessageHandler {
  async onMessage(message: ImessageMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
