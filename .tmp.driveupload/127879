/**
 * Lobster Message Handler
 */
import type { LobsterMessage } from './types';

export class LobsterHandler {
  async onMessage(message: LobsterMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
