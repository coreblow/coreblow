/**
 * MemoryLancedb Message Handler
 */
import type { MemoryLancedbMessage } from './types';

export class MemoryLancedbHandler {
  async onMessage(message: MemoryLancedbMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
