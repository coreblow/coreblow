/**
 * src/providers/interface.ts
 * Core provider interface — shared types for all AI providers
 * Used by: deepseek, groq, mistral, openrouter, fallback, and agent context
 */

// ─── Chat Message ─────────────────────────────────────────────────

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

// ─── Provider Options ─────────────────────────────────────────────

export interface ProviderOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    tools?: ProviderTool[];
    stream?: boolean;
    responseFormat?: { type: string };
}

export interface ProviderTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: unknown;
    };
}

// ─── Stream Chunks ────────────────────────────────────────────────

export type StreamChunk =
    | { type: 'text'; content: string }
    | { type: 'tool_call'; toolCall: ToolCall }
    | { type: 'done'; usage?: TokenUsage }
    | { type: 'error'; error: string };

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

// ─── Provider Interface ──────────────────────────────────────────

export interface AIProvider {
    name: string;
    chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk>;
    isAvailable(): Promise<boolean>;
    listModels(): string[] | Promise<string[]>;
}
