/** CoreBlow — Session Metadata */
export interface SessionMetadata { sessionId: string; channelId: string; userId?: string; createdAt: number; lastActivityAt: number; messageCount: number; totalTokens: number; model?: string; provider?: string; }
export function createSessionMetadata(sessionId: string, channelId: string): SessionMetadata { return { sessionId, channelId, createdAt: Date.now(), lastActivityAt: Date.now(), messageCount: 0, totalTokens: 0 }; }
