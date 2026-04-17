// sessions-resolve.ts
import { globalSessionManager } from "./session-utils.js";

export function resolveSessionKey(query: Record<string, any>): string | null {
    if (query.sessionKey) {
        return globalSessionManager.get(query.sessionKey)?.id ?? null;
    }
    if (query.userId && query.channelType) {
        return globalSessionManager.findByChannel(query.userId, query.channelType)?.id ?? null;
    }
    return null;
}
