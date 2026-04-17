/**
 * LlmTask Webhook Handler
 */
import crypto from 'node:crypto';

export class LlmTaskWebhookHandler {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  verifySignature(payload: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  async process(event: string, payload: any) {
    switch (event) {
      case 'message': return this.onMessage(payload);
      case 'reaction': return this.onReaction(payload);
      case 'member_join': return this.onMemberJoin(payload);
      case 'member_leave': return this.onMemberLeave(payload);
      default: return { event, handled: false };
    }
  }

  private async onMessage(payload: any) { return { type: 'message', ...payload }; }
  private async onReaction(payload: any) { return { type: 'reaction', ...payload }; }
  private async onMemberJoin(payload: any) { return { type: 'member_join', ...payload }; }
  private async onMemberLeave(payload: any) { return { type: 'member_leave', ...payload }; }
}
