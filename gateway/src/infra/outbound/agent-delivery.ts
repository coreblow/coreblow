/** CoreBlow — Agent Delivery */
export interface AgentDeliveryResult { delivered: boolean; channelId: string; messageId?: string; error?: string; timestamp: number; }
export function createDeliveryResult(channelId: string, delivered: boolean, messageId?: string): AgentDeliveryResult { return { delivered, channelId, messageId, timestamp: Date.now() }; }
