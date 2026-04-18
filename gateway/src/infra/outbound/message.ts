/** CoreBlow — Outbound Message */
export interface OutboundMessage { id: string; text: string; channelId: string; threadId?: string; replyTo?: string; attachments?: Array<{ type: string; url: string }>; timestamp: number; }
export function createOutboundMessage(text: string, channelId: string): OutboundMessage { return { id: crypto.randomUUID(), text, channelId, timestamp: Date.now() }; }
