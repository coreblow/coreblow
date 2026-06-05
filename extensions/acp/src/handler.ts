/**
 * Acp Message Handler
 */
import type { AcpMessage } from './types.js';

export class AcpHandler {
  async onMessage(message: AcpMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
