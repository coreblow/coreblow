/**
 * TalkVoice Message Handler
 */
import type { TalkVoiceMessage } from './types';

export class TalkVoiceHandler {
  async onMessage(message: TalkVoiceMessage) {
    return { processed: true };
  }

  async onCommand(command: string, args: string[]) {
    return { command, args, handled: true };
  }

  async onReaction(messageId: string, emoji: string) {
    return { messageId, emoji, handled: true };
  }
}
