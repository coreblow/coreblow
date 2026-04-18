/** CoreBlow — Server Session Key */ export function buildServerSessionKey(channelId: string, userId: string): string { return "srv:" + channelId + ":" + userId; }
