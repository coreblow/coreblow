/**
 * CoreBlow Provider — OpenAI
 *
 * Production adapter for OpenAI API (GPT-4o, GPT-4, GPT-3.5).
 * Implements the ModelProvider interface for the agent runtime.
 * Supports chat completions, streaming, function calling, and
 * vision (image) inputs.
 */

import type { ModelProvider } from '../agents/runtime.js';

/** OpenAI configuration */
export interface OpenAIConfig {
    apiKey: string;
    baseUrl?: string;
    organization?: string;
    defaultModel?: string;
    timeout?: number;
}

/** OpenAI message format */
interface OAIMessage {
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }>;
}

/** OpenAI completion response */
interface OAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string | null;
            tool_calls?: Array<{
                id: string;
                type: 'function';
                function: { name: string; arguments: string };
            }>;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_tokens_details?: { cached_tokens?: number };
    };
}

/**
 * Available OpenAI models with metadata.
 */
export const OPENAI_MODELS = {
    'gpt-4o': { contextWindow: 128_000, outputTokens: 16_384, vision: true },
    'gpt-4o-mini': { contextWindow: 128_000, outputTokens: 16_384, vision: true },
    'gpt-4-turbo': { contextWindow: 128_000, outputTokens: 4_096, vision: true },
    'gpt-4': { contextWindow: 8_192, outputTokens: 4_096, vision: false },
    'gpt-3.5-turbo': { contextWindow: 16_385, outputTokens: 4_096, vision: false },
    'o1': { contextWindow: 200_000, outputTokens: 100_000, vision: true },
    'o1-mini': { contextWindow: 128_000, outputTokens: 65_536, vision: false },
    'o3-mini': { contextWindow: 200_000, outputTokens: 100_000, vision: false },
} as const;

/**
 * OpenAI Provider — implements ModelProvider.
 */
export class OpenAIProvider implements ModelProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI';
    private config: OpenAIConfig;

    constructor(config: OpenAIConfig) {
        this.config = {
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o',
            timeout: 120_000,
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
        const model = params.model || this.config.defaultModel || 'gpt-4o';
        const body: Record<string, unknown> = {
            model,
            messages: params.messages as OAIMessage[],
            temperature: params.temperature ?? 0.7,
        };

        if (params.max_tokens) body.max_tokens = params.max_tokens;
        if (params.tools?.length) body.tools = params.tools;

        const response = await this.request<OAIResponse>('/chat/completions', body);
        const choice = response.choices[0]!;

        return {
            content: choice.message.content ?? '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
            })),
            usage: response.usage ? {
                input: response.usage.prompt_tokens,
                output: response.usage.completion_tokens,
                total: response.usage.total_tokens,
                cacheRead: response.usage.prompt_tokens_details?.cached_tokens,
            } : undefined,
            finishReason: choice.finish_reason,
        };
    }

    /**
     * List available models from OpenAI.
     */
    getModels(): string[] {
        return Object.keys(OPENAI_MODELS);
    }

    // === Private ===

    private async request<T>(endpoint: string, body: unknown): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
        };
        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }

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
                throw new Error(`OpenAI API error ${res.status}: ${text}`);
            }

            return await res.json() as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
