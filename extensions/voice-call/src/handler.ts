/**
 * VoiceCall Message Handler
 */
import type { VoiceCallMessage } from './types';

export class VoiceCallHandler {
  async onMessage(message: VoiceCallMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
