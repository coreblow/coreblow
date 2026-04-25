/**
 * MemoryCore Message Handler
 */
import type { MemoryCoreMessage } from './types.js';

export class MemoryCoreHandler {
  async onMessage(message: MemoryCoreMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
