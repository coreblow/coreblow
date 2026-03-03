/**
 * Signal Message Handler
 */
import type { SignalMessage } from './types.js';

export class SignalHandler {
  async onMessage(message: SignalMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
