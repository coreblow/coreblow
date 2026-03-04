/**
 * src/acp/types.ts
 * ACP (Agent Client Protocol) type definitions
 * CoreBlow's implementation — simplified & WebSocket-native (superior to stdio)
 */

export const ACP_VERSION = '0.1.0';
export const PROTOCOL_VERSION = '2025-03-26';

export interface AcpSession {
    sessionId: string;
    sessionKey: string;
    cwd: string;
    createdAt: number;
    lastTouchedAt: number;
    abortController: AbortController | null;
    activeRunId: string | null;
    metadata?: Record<string, unknown>;
}

export interface AcpServerConfig {
    gatewayUrl?: string;
    gatewayToken?: string;
    port?: number;                  // HTTP/WS port (CoreBlow superior: WS mode)
    maxSessions?: number;
    sessionIdleTtlMs?: number;
    rateLimit?: {
        maxRequests?: number;
        windowMs?: number;
    };
    verbose?: boolean;
}

export interface AcpAgentInfo {
    name: string;
    title: string;
    version: string;
}

export const ACP_AGENT_INFO: AcpAgentInfo = {
    name: 'coreblow-acp',
    title: 'CoreBlow ACP Gateway',
    version: ACP_VERSION,
};

// --- ACP Protocol Messages ---

export type AcpMessageType =
    | 'initialize'
    | 'initialize_response'
    | 'new_session'
    | 'new_session_response'
    | 'load_session'
    | 'load_session_response'
    | 'list_sessions'
    | 'list_sessions_response'
    | 'prompt'
    | 'prompt_response'
    | 'cancel'
    | 'session_update'
    | 'error';

export interface AcpMessage {
    type: AcpMessageType;
    id?: string;
    sessionId?: string;
    payload: Record<string, unknown>;
}

export interface InitializeRequest {
    protocolVersion: string;
    clientCapabilities?: {
        fs?: { readTextFile?: boolean; writeTextFile?: boolean };
        terminal?: boolean;
    };
    clientInfo?: { name: string; version: string };
}

export interface InitializeResponse {
    protocolVersion: string;
    agentCapabilities: {
        loadSession: boolean;
        promptCapabilities: {
            image: boolean;
            audio: boolean;
            video: boolean;      // SUPERIOR: CoreBlow supports video
        };
        sessionCapabilities: {
            list: Record<string, unknown>;
        };
    };
    agentInfo: AcpAgentInfo;
}

export interface NewSessionRequest {
    cwd: string;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
}

export interface NewSessionResponse {
    sessionId: string;
}

export interface PromptRequest {
    sessionId: string;
    prompt: ContentBlock[];
    metadata?: Record<string, unknown>;
}

export interface ContentBlock {
    type: 'text' | 'image' | 'resource' | 'resource_link';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
    title?: string;
}

export type StopReason = 'end_turn' | 'max_tokens' | 'cancelled' | 'error';

export interface PromptResponse {
    stopReason: StopReason;
}

export type SessionUpdateType =
    | 'agent_message_chunk'
    | 'tool_call'
    | 'tool_call_update'
    | 'available_commands_update'
    | 'usage_update';

export type ToolKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'fetch' | 'other';

export interface SessionUpdate {
    sessionId: string;
    update: {
        sessionUpdate: SessionUpdateType;
        content?: { type: string; text: string };
        toolCallId?: string;
        title?: string;
        status?: string;
        rawInput?: Record<string, unknown>;
        rawOutput?: unknown;
        kind?: ToolKind;
    };
}
