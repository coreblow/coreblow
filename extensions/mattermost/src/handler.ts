// @ts-nocheck
/**
 * Mattermost Message Handler
 */
import type { MattermostMessage } from './types.js';

export class MattermostHandler {
  async onMessage(message: MattermostMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
