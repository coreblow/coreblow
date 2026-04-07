/**
 * DiagnosticsOtel Message Handler
 */
import type { DiagnosticsOtelMessage } from './types';

export class DiagnosticsOtelHandler {
  async onMessage(message: DiagnosticsOtelMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
