/**
 * Telegram Message Handler
 */
import type { TelegramMessage } from './types.js';

export class TelegramHandler {
  async onMessage(message: TelegramMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
