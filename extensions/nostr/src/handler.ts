/**
 * Nostr Message Handler
 */
import type { NostrMessage } from './types';

export class NostrHandler {
  async onMessage(message: NostrMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
