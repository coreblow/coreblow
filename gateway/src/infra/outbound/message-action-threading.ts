/** CoreBlow — Message Action Threading */
export function resolveThreadForAction(channelId: string, messageId: string): string { return channelId + ":" + messageId; }
