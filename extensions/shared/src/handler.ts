/**
 * Shared Message Handler
 */
import type { SharedMessage } from './types';

export class SharedHandler {
  async onMessage(message: SharedMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
