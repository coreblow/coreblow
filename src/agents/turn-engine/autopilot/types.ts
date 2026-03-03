/**
 * agents/turn-engine/autopilot/types.ts
 * Core types for the AutoPilot subsystem.
 */

/** Reason for aborting a run */
export type AbortReason = string | Record<string, unknown>;

/** Diagnostic entry emitted by heartbeat monitoring */
export interface AutoPilotDiagnostic {
    timestamp: number;
    metric: string;
    value: number;
    category?: string;
}

/** Re-export DiagnosticEntry as alias for backward compat */
export type DiagnosticEntry = AutoPilotDiagnostic;

/** Inbound message entering the autopilot queue */
export interface InboundMessage {
    id: string;
    content: string;
    channel: string;
    sender: string;
    timestamp?: number;
    attachments?: Array<{ url: string; type?: string; name?: string }>;
    replyTo?: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
}

/** Options for getReply calls */
export interface GetReplyOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: string[];
    stream?: boolean;
    signal?: AbortSignal;
    sessionOverrides?: Record<string, unknown>;
}

/** Payload returned from a reply operation */
export interface ReplyPayload {
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    embeds?: Array<Record<string, unknown>>;
    components?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
}
