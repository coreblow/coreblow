/** CoreBlow — Sessions Send Helpers */ export function buildSendPayload(text: string, channelId: string): Record<string, unknown> { return { text, channelId, timestamp: Date.now() }; }
