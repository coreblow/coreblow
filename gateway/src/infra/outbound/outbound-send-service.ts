/** CoreBlow — Outbound Send Service */
import type { OutboundMessage } from "./message.js";
export interface SendResult { success: boolean; messageId?: string; error?: string; }
export async function sendMessage(message: OutboundMessage): Promise<SendResult> { return { success: true, messageId: message.id }; }
