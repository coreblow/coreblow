/**
 * Acpx Message Handler
 */
import type { AcpxMessage } from './types.js';

export class AcpxHandler {
  async onMessage(message: AcpxMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
