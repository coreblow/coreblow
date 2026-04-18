// Keep server maxPayload aligned with gateway client maxPayload so high-res canvas snapshots
// don't get disconnected mid-invoke with "Max payload size exceeded".
export const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_BUFFERED_BYTES = 50 * 1024 * 1024; // per-connection send buffer limit (2x max payload)
export const MAX_PREAUTH_PAYLOAD_BYTES = 64 * 1024;
export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const NODE_WAKE_RECONNECT_WAIT_MS = 8_000;
export const NODE_WAKE_RECONNECT_RETRY_WAIT_MS = 12_000;

// Maintenance timer intervals (milliseconds)
export const TICK_INTERVAL_MS = 30_000;
export const HEALTH_REFRESH_INTERVAL_MS = 60_000;
export const DEDUPE_TTL_MS = 5 * 60_000;
export const DEDUPE_MAX = 1000;

// Chat history size limits
const DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES = 6 * 1024 * 1024;
let maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;

export const getMaxChatHistoryMessagesBytes = () => maxChatHistoryMessagesBytes;

export const __setMaxChatHistoryMessagesBytesForTest = (value?: number) => {
    if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        return;
    }
    if (value === undefined) {
        maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;
        return;
    }
    if (Number.isFinite(value) && value > 0) {
        maxChatHistoryMessagesBytes = value;
    }
};
