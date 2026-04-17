/**
 * src/channels/types-rpc.ts
 * Shared strict interfaces for RPC-based channel adapters (iMessage, Signal, Gmail).
 * Replaces `unknown` payloads with explicit schemas to satisfy TS18046.
 * Follows OpenClaw explicit interface boundary pattern.
 */

export interface JsonRpcResponse<T = unknown> {
    jsonrpc?: string;
    id?: number | string | null;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    method?: string;
    params?: Record<string, unknown>;
}

export function isJsonRpcResponse(payload: unknown): payload is JsonRpcResponse {
    return typeof payload === 'object' && payload !== null;
}

export interface ChannelSendResult {
    messageId?: string;
    id?: string;
    status?: string;
}

export interface IMessageNotification {
    method: string;
    params?: {
        sender?: string;
        from?: string;
        text?: string;
        body?: string;
        chat_id?: string;
        chatId?: string;
        message_id?: string;
        id?: string;
        guid?: string;
        senderName?: string;
        date?: string | number;
    };
}
