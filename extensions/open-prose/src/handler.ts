/**
 * OpenProse Message Handler
 */
import type { OpenProseMessage } from './types.js';

export class OpenProseHandler {
  async onMessage(message: OpenProseMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
