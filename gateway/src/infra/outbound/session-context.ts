/** CoreBlow — Session Context */
export interface SessionContext { sessionId: string; channelId: string; userId?: string; conversationId?: string; metadata: Record<string, unknown>; }
export function createSessionContext(sessionId: string, channelId: string): SessionContext { return { sessionId, channelId, metadata: {} }; }
