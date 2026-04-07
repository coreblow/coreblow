/**
 * TestUtils Message Handler
 */
import type { TestUtilsMessage } from './types';

export class TestUtilsHandler {
  async onMessage(message: TestUtilsMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
