/**
 * GoogleGeminiCliAuth Message Handler
 */
import type { GoogleGeminiCliAuthMessage } from './types.js';

export class GoogleGeminiCliAuthHandler {
  async onMessage(message: GoogleGeminiCliAuthMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
