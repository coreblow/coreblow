/** CoreBlow — Channel Target */
export interface ChannelTarget { channelId: string; userId?: string; threadId?: string; roomId?: string; }
export function formatChannelTarget(t: ChannelTarget): string { const parts = [t.channelId]; if (t.userId) parts.push("user:" + t.userId); if (t.threadId) parts.push("thread:" + t.threadId); return parts.join("/"); }
