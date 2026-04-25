/**
 * DevicePair Message Handler
 */
import type { DevicePairMessage } from './types.js';

export class DevicePairHandler {
  async onMessage(message: DevicePairMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
