/**
 * Slack Message Handler
 */
import type { SlackMessage } from './types';

export class SlackHandler {
  async onMessage(message: SlackMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
