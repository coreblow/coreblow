// @ts-nocheck
/**
 * Bluebubbles Message Handler
 */
import type { BluebubblesMessage } from './types.js';

export class BluebubblesHandler {
  async onMessage(message: BluebubblesMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
