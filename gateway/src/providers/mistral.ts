/**
 * src/providers/mistral.ts
 * Mistral AI provider — mistral-large, codestral, mistral-small
 * Uses OpenAI-compatible API endpoint
 */

import { createChildLogger } from '../utils/logger.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';

const log = createChildLogger('provider:mistral');

export class MistralProvider implements AIProvider {
    name = 'mistral';
    private apiKey: string;
    private baseUrl: string;

    constructor(opts: { apiKey?: string; baseUrl?: string } = {}) {
        this.apiKey = opts.apiKey || process.env.MISTRAL_API_KEY || '';
        this.baseUrl = opts.baseUrl || 'https://api.mistral.ai/v1';
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const model = options.model || 'mistral-large-latest';

        const body: Record<string, any> = {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            stream: true,
        };

        if (options.tools?.length) {
            body.tools = options.tools;
        }

        try {
            const res = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                log.error({ status: res.status, err }, 'Mistral API error');
                yield { type: 'error', error: `Mistral ${res.status}: ${err}` };
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                        yield { type: 'done', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
                        continue;
                    }

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta;
                        if (!delta) continue;

                        if (delta.content) {
                            yield { type: 'text', content: delta.content };
                        }

                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                if (tc.function?.name) {
                                    yield {
                                        type: 'tool_call',
                                        toolCall: {
                                            id: tc.id || `mistral_${Date.now()}`,
                                            type: 'function' as const,
                                            function: {
                                                name: tc.function.name,
                                                arguments: tc.function.arguments || '{}',
                                            },
                                        },
                                    };
                                }
                            }
                        }

                        if (json.usage) {
                            yield {
                                type: 'done',
                                usage: {
                                    promptTokens: json.usage.prompt_tokens,
                                    completionTokens: json.usage.completion_tokens,
                                    totalTokens: json.usage.total_tokens,
                                },
                            };
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, 'Mistral connection error');
            yield { type: 'error', error: err.message };
        }
    }

    async isAvailable(): Promise<boolean> { return Boolean(this.apiKey); }
    listModels(): string[] { return ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest']; }
}
