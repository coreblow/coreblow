/**
 * Whatsapp Message Handler
 */
import type { WhatsappMessage } from './types';

export class WhatsappHandler {
  async onMessage(message: WhatsappMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
