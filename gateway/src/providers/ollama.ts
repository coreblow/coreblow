/**
 * src/providers/ollama.ts
 * Ollama local AI provider (FREE)
 */

import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk, ToolCall } from './interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider:ollama');

export class OllamaProvider implements AIProvider {
    name = 'ollama';
    private baseUrl: string;

    constructor(baseUrl = 'http://127.0.0.1:11434') {
        this.baseUrl = baseUrl;
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const body = {
            model: options.model,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
            })),
            stream: true,
            options: {
                num_predict: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7,
            },
            ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
        };

        try {
            const res = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                yield { type: 'error', error: `Ollama error ${res.status}: ${errText}` };
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                yield { type: 'error', error: 'No response body' };
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);

                        // Check for tool calls
                        if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
                            for (const tc of data.message.tool_calls) {
                                const toolCall: ToolCall = {
                                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                    type: 'function',
                                    function: {
                                        name: tc.function.name,
                                        arguments: typeof tc.function.arguments === 'string'
                                            ? tc.function.arguments
                                            : JSON.stringify(tc.function.arguments),
                                    },
                                };
                                yield { type: 'tool_call', toolCall };
                            }
                        }

                        // Text content
                        if (data.message?.content) {
                            yield { type: 'text', content: data.message.content };
                        }

                        // Done
                        if (data.done) {
                            yield {
                                type: 'done',
                                usage: {
                                    promptTokens: data.prompt_eval_count || 0,
                                    completionTokens: data.eval_count || 0,
                                    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                                },
                            };
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, 'Ollama request failed');
            yield { type: 'error', error: `Connection failed: ${err.message}` };
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            return res.ok;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            if (!res.ok) return [];
            const data: any = await res.json();
            return (data.models || []).map((m: any) => m.name);
        } catch {
            return [];
        }
    }
}
