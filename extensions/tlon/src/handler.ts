// @ts-nocheck
/**
 * Tlon Message Handler
 */
import type { TlonMessage } from './types.js';

export class TlonHandler {
  async onMessage(message: TlonMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
