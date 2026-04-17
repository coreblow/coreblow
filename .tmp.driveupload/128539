/**
 * QwenPortalAuth Message Handler
 */
import type { QwenPortalAuthMessage } from './types';

export class QwenPortalAuthHandler {
  async onMessage(message: QwenPortalAuthMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
