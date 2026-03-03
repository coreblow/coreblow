/**
 * LlmTask Message Handler
 */
import type { LlmTaskMessage } from './types.js';

export class LlmTaskHandler {
  async onMessage(message: LlmTaskMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
