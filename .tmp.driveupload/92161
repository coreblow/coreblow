import type { ChatRunState } from "./gateway-types.js";

export function abortChatRun(chatRunState: Map<string, ChatRunState>, sessionKey: string) {
    if (chatRunState && chatRunState.has(sessionKey)) {
        const aborter = chatRunState.get(sessionKey);
        if (aborter && typeof aborter.abort === "function") {
            aborter.abort();
            chatRunState.delete(sessionKey);
            return true;
        }
    }
    return false;
}
