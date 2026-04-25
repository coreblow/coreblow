// @ts-nocheck
/**
 * NextcloudTalk Message Handler
 */
import type { NextcloudTalkMessage } from './types.js';

export class NextcloudTalkHandler {
  async onMessage(message: NextcloudTalkMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
