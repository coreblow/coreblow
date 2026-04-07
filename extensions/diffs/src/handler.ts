/**
 * Diffs Message Handler
 */
import type { DiffsMessage } from './types';

export class DiffsHandler {
  async onMessage(message: DiffsMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
