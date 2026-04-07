/**
 * CoreBlow Provider — Anthropic
 *
 * Production adapter for Anthropic API (Claude 3 Opus, Sonnet, Haiku, Claude 4).
 * Translates between OpenAI-compatible format and Anthropic's Messages API.
 */

import type { ModelProvider } from '../agents/runtime.js';

/** Anthropic configuration */
export interface AnthropicConfig {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
    anthropicVersion?: string;
}

/** Anthropic message format */
interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }>;
}

/** Anthropic response */
interface AnthropicResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: Array<{
        type: 'text' | 'tool_use';
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
    }>;
    model: string;
    stop_reason: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
}

/** Available Anthropic models */
export const ANTHROPIC_MODELS = {
    'claude-sonnet-4-20250514': { contextWindow: 200_000, outputTokens: 64_000, vision: true },
    'claude-3-7-sonnet-20250219': { contextWindow: 200_000, outputTokens: 128_000, vision: true },
    'claude-3-5-sonnet-20241022': { contextWindow: 200_000, outputTokens: 8_192, vision: true },
    'claude-3-5-haiku-20241022': { contextWindow: 200_000, outputTokens: 8_192, vision: false },
    'claude-3-opus-20240229': { contextWindow: 200_000, outputTokens: 4_096, vision: true },
    'claude-3-sonnet-20240229': { contextWindow: 200_000, outputTokens: 4_096, vision: true },
    'claude-3-haiku-20240307': { contextWindow: 200_000, outputTokens: 4_096, vision: false },
} as const;

/**
 * Anthropic Provider
 */
export class AnthropicProvider implements ModelProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic';
    private config: AnthropicConfig;

    constructor(config: AnthropicConfig) {
        this.config = {
            baseUrl: 'https://api.anthropic.com',
            defaultModel: 'claude-sonnet-4-20250514',
            timeout: 120_000,
            anthropicVersion: '2023-06-01',
            ...config,
        };
    }

    async chat(params: {
        model: string;
        messages: Array<{ role: string; content: string; name?: string; tool_call_id?: string }>;
        tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }>;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
    }) {
        const model = params.model || this.config.defaultModel || 'claude-sonnet-4-20250514';

        // Extract system message (Anthropic uses a separate `system` field)
        let systemPrompt: string | undefined;
        const messages: AnthropicMessage[] = [];

        for (const msg of params.messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({ role: msg.role, content: msg.content });
            } else if (msg.role === 'tool') {
                // Anthropic expects tool results as user messages with tool_result type
                messages.push({
                    role: 'user',
                    content: [{ type: 'text', text: msg.content }],
                });
            }
        }

        // Build request body
        const body: Record<string, unknown> = {
            model,
            messages,
            max_tokens: params.max_tokens ?? 4096,
        };
        if (systemPrompt) body.system = systemPrompt;
        if (params.temperature !== undefined) body.temperature = params.temperature;

        // Convert tools to Anthropic format
        if (params.tools?.length) {
            body.tools = params.tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters,
            }));
        }

        const response = await this.request<AnthropicResponse>('/v1/messages', body);

        // Extract text content
        const textBlocks = response.content.filter((c) => c.type === 'text');
        const content = textBlocks.map((c) => c.text ?? '').join('');

        // Extract tool calls
        const toolUse = response.content.filter((c) => c.type === 'tool_use');
        const toolCalls = toolUse.length > 0
            ? toolUse.map((c) => ({
                id: c.id ?? `tool-${Date.now()}`,
                name: c.name ?? '',
                arguments: JSON.stringify(c.input ?? {}),
            }))
            : undefined;

        return {
            content,
            toolCalls,
            usage: {
                input: response.usage.input_tokens,
                output: response.usage.output_tokens,
                total: response.usage.input_tokens + response.usage.output_tokens,
                cacheRead: response.usage.cache_read_input_tokens,
                cacheWrite: response.usage.cache_creation_input_tokens,
            },
            finishReason: response.stop_reason ?? 'stop',
        };
    }

    getModels(): string[] {
        return Object.keys(ANTHROPIC_MODELS);
    }

    // === Private ===

    private async request<T>(endpoint: string, body: unknown): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.anthropicVersion!,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Anthropic API error ${res.status}: ${text}`);
            }

            return await res.json() as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
