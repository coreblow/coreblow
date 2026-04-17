/**
 * CoreBlow Agent Runtime Engine
 *
 * Core agent execution engine: session lifecycle, multi-turn conversation
 * with context window management, tool execution pipeline, model routing,
 * token budget tracking, and streaming response support.
 *
 * This is the heart of CoreBlow — where user messages become AI responses.
 */

/** Agent session state */
export type SessionState = 'idle' | 'processing' | 'streaming' | 'tool-calling' | 'complete' | 'error';

/** Message in the conversation */
export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
    toolCalls?: ToolCall[];
    timestamp: number;
    tokenEstimate?: number;
}

/** Tool call request from the model */
export interface ToolCall {
    id: string;
    name: string;
    arguments: string;
}

/** Tool execution result */
export interface ToolResult {
    callId: string;
    name: string;
    output: string;
    error?: string;
    durationMs: number;
}

/** Token usage tracking */
export interface TokenUsage {
    input: number;
    output: number;
    total: number;
    cacheRead?: number;
    cacheWrite?: number;
}

/** Agent session configuration */
export interface AgentSessionConfig {
    /** Model to use (e.g., "gpt-4o", "claude-3-opus") */
    model: string;
    /** Provider (e.g., "openai", "anthropic", "google") */
    provider?: string;
    /** System prompt */
    systemPrompt?: string;
    /** Maximum context window tokens */
    maxContextTokens?: number;
    /** Maximum output tokens */
    maxOutputTokens?: number;
    /** Temperature */
    temperature?: number;
    /** Available tools */
    tools?: ToolDefinition[];
    /** Token budget (total tokens allowed for this session) */
    tokenBudget?: number;
    /** Whether to stream responses */
    stream?: boolean;
}

/** Tool definition for the model */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<string>;
}

/** Streaming chunk callback */
export type StreamCallback = (chunk: string, done: boolean) => void;

/** Model provider interface */
export interface ModelProvider {
    id: string;
    name: string;
    chat(params: {
        model: string;
        messages: Array<{ role: string; content: string; name?: string; tool_call_id?: string }>;
        tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }>;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
    }): Promise<{
        content: string;
        toolCalls?: ToolCall[];
        usage?: TokenUsage;
        finishReason?: string;
    }>;
}

/**
 * CoreBlow Agent Runtime
 */
export class AgentRuntime {
    private sessions = new Map<string, AgentSession>();
    private providers = new Map<string, ModelProvider>();
    private defaultProvider: string | null = null;

    /**
     * Register a model provider.
     */
    registerProvider(provider: ModelProvider, isDefault?: boolean): void {
        this.providers.set(provider.id, provider);
        if (isDefault || !this.defaultProvider) {
            this.defaultProvider = provider.id;
        }
    }

    /**
     * Create a new agent session.
     */
    createSession(sessionId: string, config: AgentSessionConfig): AgentSession {
        if (this.sessions.has(sessionId)) {
            throw new Error(`Session "${sessionId}" already exists`);
        }

        const providerId = config.provider ?? this.defaultProvider;
        if (!providerId) throw new Error('No model provider registered');

        const provider = this.providers.get(providerId);
        if (!provider) throw new Error(`Provider "${providerId}" not found`);

        const session = new AgentSession(sessionId, config, provider);
        this.sessions.set(sessionId, session);
        return session;
    }

    /**
     * Get an existing session.
     */
    getSession(sessionId: string): AgentSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    /**
     * Destroy a session.
     */
    destroySession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    /**
     * List active sessions.
     */
    listSessions(): Array<{ id: string; state: SessionState; messageCount: number; tokenUsage: TokenUsage }> {
        return Array.from(this.sessions.values()).map((s) => ({
            id: s.id,
            state: s.getState(),
            messageCount: s.getMessages().length,
            tokenUsage: s.getTokenUsage(),
        }));
    }
}

/**
 * Individual Agent Session — manages a conversation.
 */
export class AgentSession {
    readonly id: string;
    private config: AgentSessionConfig;
    private provider: ModelProvider;
    private messages: ConversationMessage[] = [];
    private state: SessionState = 'idle';
    private tokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };
    private toolMap = new Map<string, ToolDefinition>();
    private createdAt = Date.now();

    constructor(id: string, config: AgentSessionConfig, provider: ModelProvider) {
        this.id = id;
        this.config = config;
        this.provider = provider;

        // Index tools
        for (const tool of config.tools ?? []) {
            this.toolMap.set(tool.name, tool);
        }

        // Add system prompt
        if (config.systemPrompt) {
            this.messages.push({
                role: 'system',
                content: config.systemPrompt,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Send a user message and get a response.
     * Handles multi-turn tool calling automatically.
     */
    async chat(userMessage: string, onStream?: StreamCallback): Promise<string> {
        this.state = 'processing';

        // Add user message
        this.messages.push({
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
        });

        try {
            // Context window management — trim if needed
            const contextMessages = this.getContextWindow();

            // Build tool specs
            const tools = this.config.tools?.map((t) => ({
                type: 'function' as const,
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters as unknown,
                },
            }));

            // Call model
            const response = await this.provider.chat({
                model: this.config.model,
                messages: contextMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                    name: m.name,
                    tool_call_id: m.toolCallId,
                })),
                tools: tools?.length ? tools : undefined,
                temperature: this.config.temperature,
                max_tokens: this.config.maxOutputTokens,
                stream: this.config.stream,
            });

            // Track usage
            if (response.usage) {
                this.tokenUsage.input += response.usage.input;
                this.tokenUsage.output += response.usage.output;
                this.tokenUsage.total += response.usage.total;
            }

            // Handle tool calls
            if (response.toolCalls && response.toolCalls.length > 0) {
                this.state = 'tool-calling';

                // Add assistant message with tool calls
                this.messages.push({
                    role: 'assistant',
                    content: response.content || '',
                    toolCalls: response.toolCalls,
                    timestamp: Date.now(),
                });

                // Execute each tool
                for (const call of response.toolCalls) {
                    const result = await this.executeTool(call);
                    this.messages.push({
                        role: 'tool',
                        content: result.output,
                        name: result.name,
                        toolCallId: result.callId,
                        timestamp: Date.now(),
                    });
                }

                // Continue conversation with tool results
                return this.chat('', onStream);
            }

            // Regular response
            const assistantContent = response.content;
            this.messages.push({
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
            });

            if (onStream) {
                onStream(assistantContent, true);
            }

            this.state = 'idle';
            return assistantContent;
        } catch (err) {
            this.state = 'error';
            throw err;
        }
    }

    /**
     * Get all messages in the conversation.
     */
    getMessages(): ConversationMessage[] {
        return [...this.messages];
    }

    /**
     * Get current session state.
     */
    getState(): SessionState {
        return this.state;
    }

    /**
     * Get token usage.
     */
    getTokenUsage(): TokenUsage {
        return { ...this.tokenUsage };
    }

    /**
     * Check if token budget is exceeded.
     */
    isBudgetExceeded(): boolean {
        if (!this.config.tokenBudget) return false;
        return this.tokenUsage.total >= this.config.tokenBudget;
    }

    /**
     * Reset the conversation (keep system prompt).
     */
    reset(): void {
        const systemMsg = this.messages.find((m) => m.role === 'system');
        this.messages = systemMsg ? [systemMsg] : [];
        this.tokenUsage = { input: 0, output: 0, total: 0 };
        this.state = 'idle';
    }

    // === Private ===

    /**
     * Get messages that fit the context window.
     * Keeps system prompt + as many recent messages as fit.
     */
    private getContextWindow(): ConversationMessage[] {
        const maxTokens = this.config.maxContextTokens ?? 128_000;
        const messages = [...this.messages];

        // Estimate tokens (rough: 4 chars ≈ 1 token)
        let totalTokens = 0;
        for (const msg of messages) {
            totalTokens += Math.ceil(msg.content.length / 4);
        }

        // If within budget, return all
        if (totalTokens <= maxTokens) return messages;

        // Keep system message + trim from the middle
        const result: ConversationMessage[] = [];
        const systemMsg = messages.find((m) => m.role === 'system');
        if (systemMsg) {
            result.push(systemMsg);
            totalTokens = Math.ceil(systemMsg.content.length / 4);
        }

        // Add messages from most recent backwards
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]!;
            if (msg.role === 'system') continue;
            const msgTokens = Math.ceil(msg.content.length / 4);
            if (totalTokens + msgTokens > maxTokens) break;
            totalTokens += msgTokens;
            result.splice(systemMsg ? 1 : 0, 0, msg);
        }

        return result;
    }

    /**
     * Execute a tool call.
     */
    private async executeTool(call: ToolCall): Promise<ToolResult> {
        const start = Date.now();
        const tool = this.toolMap.get(call.name);

        if (!tool) {
            return {
                callId: call.id,
                name: call.name,
                output: `Error: Tool "${call.name}" not found`,
                error: 'Tool not found',
                durationMs: Date.now() - start,
            };
        }

        try {
            const args = JSON.parse(call.arguments) as Record<string, unknown>;
            const output = await tool.handler(args);
            return {
                callId: call.id,
                name: call.name,
                output,
                durationMs: Date.now() - start,
            };
        } catch (err) {
            return {
                callId: call.id,
                name: call.name,
                output: `Error: ${err instanceof Error ? err.message : String(err)}`,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
            };
        }
    }
}
