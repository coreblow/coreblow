/**
 * acp/types.ts
 * Agent Communication Protocol — Core type definitions.
 * Used across the gateway for agent-to-agent messaging contracts.
 */

export type ACPMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ACPMessage {
    role: ACPMessageRole;
    content: string;
    name?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
}

export interface ACPToolCall {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
}

export interface ACPToolResult {
    toolCallId: string;
    content: string;
    isError?: boolean;
}

export interface ACPConversation {
    sessionKey: string;
    messages: ACPMessage[];
    model?: string;
    provider?: string;
    createdAt: number;
    updatedAt: number;
}

export interface ACPRequest {
    messages: ACPMessage[];
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: ACPToolDefinition[];
    stream?: boolean;
}

export interface ACPResponse {
    content: string;
    role: ACPMessageRole;
    toolCalls?: ACPToolCall[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    model?: string;
    finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ACPToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface ACPStreamChunk {
    type: 'content' | 'tool_call' | 'done' | 'error';
    content?: string;
    toolCall?: ACPToolCall;
    error?: string;
}

export interface ACPProviderConfig {
    id: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    maxRetries?: number;
    timeoutMs?: number;
}

export interface ACPAgentCapabilities {
    tools: boolean;
    streaming: boolean;
    vision: boolean;
    functionCalling: boolean;
    json: boolean;
}

export interface AcpSession {
    sessionId: string;
    sessionKey: string;
    cwd: string;
    createdAt: number;
    lastTouchedAt: number;
    activeRunId: string | null;
    abortController: AbortController | null;
    messages?: ACPMessage[];
    metadata?: Record<string, unknown>;
}

export type ContentBlock = any;
export type ToolKind = any;
