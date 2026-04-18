/** CoreBlow — Exec Approval Session Target */
export interface SessionTarget { sessionId: string; channelId: string; agentId?: string; }
export function resolveSessionTarget(sessionId: string, channelId: string): SessionTarget { return { sessionId, channelId }; }
