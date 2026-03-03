/**
 * CoreBlow AutoPilot — getOrCreateSession
 */
import type { SessionState } from './types.js';
import { sessions } from './session.data.js';
export function getOrCreateSession(sessionKey: string, agentId: string): SessionState {
    let session = sessions.get(sessionKey);
    if (!session) {
        session = {
            sessionKey, agentId,
            createdAt: Date.now(), lastAccessedAt: Date.now(),
            turnCount: 0, totalInputTokens: 0, totalOutputTokens: 0,
            compactionCount: 0, isActive: true,
        };
        sessions.set(sessionKey, session);
    }
    session.lastAccessedAt = Date.now();
    return session;
}
