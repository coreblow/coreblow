/** CoreBlow — Main Session */
export interface MainSession { sessionId: string; channelId: string; startedAt: number; isActive: boolean; }
export function createMainSession(sessionId: string, channelId: string): MainSession { return { sessionId, channelId, startedAt: Date.now(), isActive: true }; }
