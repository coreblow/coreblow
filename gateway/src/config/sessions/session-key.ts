/** CoreBlow — Session Key */
export interface SessionKey { channelId: string; userId: string; threadId?: string; }
export function createSessionKey(channelId: string, userId: string, threadId?: string): string { const parts = [channelId, userId]; if (threadId) parts.push(threadId); return parts.join(":"); }
export function parseSessionKey(key: string): SessionKey | null { const parts = key.split(":"); if (parts.length < 2) return null; return { channelId: parts[0], userId: parts[1], threadId: parts[2] }; }
