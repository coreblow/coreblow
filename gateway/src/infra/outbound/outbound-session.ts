/** CoreBlow — Outbound Session */
export interface OutboundSession { sessionId: string; channelId: string; startedAt: number; messageCount: number; }
const sessions = new Map<string, OutboundSession>();
export function getOrCreateSession(sessionId: string, channelId: string): OutboundSession { if (!sessions.has(sessionId)) sessions.set(sessionId, { sessionId, channelId, startedAt: Date.now(), messageCount: 0 }); return sessions.get(sessionId)!; }
