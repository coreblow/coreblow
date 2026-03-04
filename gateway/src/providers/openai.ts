/**
 * src/providers/openai.ts
 * OpenAI + OpenRouter provider adapter
 */

import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk, ToolCall } from './interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider:openai');

export class OpenAIProvider implements AIProvider {
    name: string;
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1', name = 'openai') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.name = name;
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const body: any = {
            model: options.model,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.name ? { name: m.name } : {}),
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            })),
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            stream: true,
        };

        if (options.tools && options.tools.length > 0) {
            body.tools = options.tools;
            body.tool_choice = 'auto';
        }

        try {
            const res = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                yield { type: 'error', error: `${this.name} error ${res.status}: ${errText}` };
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                yield { type: 'error', error: 'No response body' };
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';
            const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

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
                        // Emit accumulated tool calls
                        for (const [, tc] of toolCalls) {
                            yield {
                                type: 'tool_call',
                                toolCall: {
                                    id: tc.id,
                                    type: 'function',
                                    function: { name: tc.name, arguments: tc.args },
                                },
                            };
                        }
                        yield { type: 'done' };
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;

                        if (!delta) continue;

                        // Text content
                        if (delta.content) {
                            yield { type: 'text', content: delta.content };
                        }

                        // Tool calls (accumulated across chunks)
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index ?? 0;
                                if (!toolCalls.has(idx)) {
                                    toolCalls.set(idx, { id: tc.id || '', name: '', args: '' });
                                }
                                const entry = toolCalls.get(idx)!;
                                if (tc.id) entry.id = tc.id;
                                if (tc.function?.name) entry.name += tc.function.name;
                                if (tc.function?.arguments) entry.args += tc.function.arguments;
                            }
                        }

                        // Usage in final chunk
                        if (parsed.usage) {
                            yield {
                                type: 'done',
                                usage: {
                                    promptTokens: parsed.usage.prompt_tokens,
                                    completionTokens: parsed.usage.completion_tokens,
                                    totalTokens: parsed.usage.total_tokens,
                                },
                            };
                        }
                    } catch {
                        // Skip malformed SSE
                    }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, `${this.name} request failed`);
            yield { type: 'error', error: `Connection failed: ${err.message}` };
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` },
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` },
            });
            if (!res.ok) return [];
            const data: any = await res.json();
            return (data.data || []).map((m: any) => m.id);
        } catch {
            return [];
        }
    }
}
