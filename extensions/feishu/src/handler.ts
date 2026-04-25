// @ts-nocheck
/**
 * Feishu Message Handler
 */
import type { FeishuMessage } from './types.js';

export class FeishuHandler {
  async onMessage(message: FeishuMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
