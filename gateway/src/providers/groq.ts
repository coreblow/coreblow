/**
 * src/providers/groq.ts
 * Groq provider — fastest inference (LPU hardware)
 * OpenAI-compatible API
 */

import { createChildLogger } from '../utils/logger.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';

const log = createChildLogger('provider:groq');

export class GroqProvider implements AIProvider {
    name = 'groq';
    private apiKey: string;

    constructor(opts: { apiKey?: string } = {}) {
        this.apiKey = opts.apiKey || process.env.GROQ_API_KEY || '';
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const model = options.model || 'llama-3.3-70b-versatile';

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
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                yield { type: 'error', error: `Groq ${res.status}: ${err}` };
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
                        if (delta?.content) yield { type: 'text', content: delta.content };
                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                if (tc.function?.name) {
                                    yield { type: 'tool_call', toolCall: { id: tc.id, type: 'function' as const, function: { name: tc.function.name, arguments: tc.function.arguments || '{}' } } };
                                }
                            }
                        }
                        if (json.x_groq?.usage) {
                            yield {
                                type: 'done', usage: {
                                    promptTokens: json.x_groq.usage.prompt_tokens,
                                    completionTokens: json.x_groq.usage.completion_tokens,
                                    totalTokens: json.x_groq.usage.total_tokens,
                                }
                            };
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, 'Groq error');
            yield { type: 'error', error: err.message };
        }
    }

    async isAvailable(): Promise<boolean> { return Boolean(this.apiKey); }
    listModels(): string[] { return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']; }
}
