/**
 * PhoneControl Message Handler
 */
import type { PhoneControlMessage } from './types.js';

export class PhoneControlHandler {
  async onMessage(message: PhoneControlMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
