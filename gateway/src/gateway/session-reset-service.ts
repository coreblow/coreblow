// session-reset-service.ts
import { globalSessionManager } from "./session-utils.js";

export const sessionResetService = {
    async resetSession(sessionKey: string): Promise<boolean> {
        const session = globalSessionManager.get(sessionKey);
        if (!session) return false;
        
        session.metadata.lastReset = Date.now();
        globalSessionManager.touch(sessionKey);
        return true;
    },
    
    async compactSession(sessionKey: string): Promise<boolean> {
        const session = globalSessionManager.get(sessionKey);
        if (!session) return false;

        session.metadata.lastCompacted = Date.now();
        globalSessionManager.touch(sessionKey);
        return true;
    },

    async archiveSession(sessionKey: string): Promise<boolean> {
        const session = globalSessionManager.get(sessionKey);
        if (!session) return false;
        
        session.metadata.archived = true;
        globalSessionManager.destroy(sessionKey);
        return true; // We don't implement full disk archiving in CoreBlow
    }
};
