/**
 * WorkflowShell Message Handler
 */
import type { WorkflowShellMessage } from './types.js';

export class WorkflowShellHandler {
  async onMessage(message: WorkflowShellMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
