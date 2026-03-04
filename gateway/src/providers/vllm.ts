/**
 * src/providers/vllm.ts
 * vLLM provider — self-hosted LLM inference via OpenAI-compatible API
 */

import type { AIProvider, ChatMessage, ChatOptions, ChatResponse } from './interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider:vllm');

export class VLLMProvider implements AIProvider {
    name = 'vllm';
    private baseUrl: string;
    private model: string;
    private apiKey?: string;

    constructor(config?: { baseUrl?: string; model?: string; apiKey?: string }) {
        this.baseUrl = config?.baseUrl || 'http://localhost:8000';
        this.model = config?.model || 'default';
        this.apiKey = config?.apiKey;
    }

    async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
        const url = `${this.baseUrl}/v1/chat/completions`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const body: Record<string, any> = {
            model: options?.model || this.model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            max_tokens: options?.maxTokens || 4096,
        };

        if (options?.temperature !== undefined) body.temperature = options.temperature;
        if (options?.tools) body.tools = options.tools;

        try {
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(`vLLM error: ${res.status} ${await res.text()}`);

            const data = await res.json() as any;
            const choice = data.choices?.[0];

            return {
                text: choice?.message?.content || '',
                toolCalls: choice?.message?.tool_calls,
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                },
                raw: data,
            };
        } catch (err: any) {
            log.error({ err: err.message, url }, 'vLLM chat failed');
            throw err;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
            return res.ok;
        } catch {
            return false;
        }
    }

    listModels(): string[] {
        return [this.model];
    }
}
