/**
 * CoreBlow AutoPilot — deleteSession
 */
import { sessions } from './session.data.js';
export function deleteSession(sessionKey: string): boolean {
    return sessions.delete(sessionKey);
}
