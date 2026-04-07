/**
 * ThreadOwnership Message Handler
 */
import type { ThreadOwnershipMessage } from './types';

export class ThreadOwnershipHandler {
  async onMessage(message: ThreadOwnershipMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
