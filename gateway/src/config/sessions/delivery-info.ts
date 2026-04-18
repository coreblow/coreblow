/** CoreBlow — Session Delivery Info */
export interface DeliveryInfo { channelId: string; messageId?: string; threadId?: string; deliveredAt: number; }
export function createDeliveryInfo(channelId: string, messageId?: string): DeliveryInfo { return { channelId, messageId, deliveredAt: Date.now() }; }
