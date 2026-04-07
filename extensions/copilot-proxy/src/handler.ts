/**
 * CopilotProxy Message Handler
 */
import type { CopilotProxyMessage } from './types';

export class CopilotProxyHandler {
  async onMessage(message: CopilotProxyMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
