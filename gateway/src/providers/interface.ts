/**
 * src/providers/interface.ts
 * Base AI provider interface
 */

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

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
}

export interface ProviderOptions {
    model: string;
    maxTokens?: number;
    temperature?: number;
    tools?: ToolDefinition[];
    stream?: boolean;
}

export interface StreamChunk {
    type: 'text' | 'tool_call' | 'done' | 'error';
    content?: string;
    toolCall?: ToolCall;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    error?: string;
}

export interface AIProvider {
    name: string;

    /**
     * Send a chat completion request with streaming
     */
    chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk>;

    /**
     * Check if provider is available
     */
    isAvailable(): Promise<boolean>;

    /**
     * List available models
     */
    listModels(): Promise<string[]>;
}
