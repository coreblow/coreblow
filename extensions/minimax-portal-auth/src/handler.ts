/**
 * MinimaxPortalAuth Message Handler
 */
import type { MinimaxPortalAuthMessage } from './types';

export class MinimaxPortalAuthHandler {
  async onMessage(message: MinimaxPortalAuthMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
