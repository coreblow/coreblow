/** CoreBlow — Conversation Label */ export function formatConversationLabel(channelType: string, channelId: string): string { return channelType + ":" + channelId.slice(0, 8); }
