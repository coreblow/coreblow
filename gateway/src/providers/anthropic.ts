/**
 * src/providers/anthropic.ts
 * Anthropic Claude provider adapter
 */

import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider:anthropic');

export class AnthropicProvider implements AIProvider {
    name = 'anthropic';
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        // Separate system message
        const systemMsg = messages.find((m) => m.role === 'system');
        const nonSystem = messages.filter((m) => m.role !== 'system');

        const body: any = {
            model: options.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            stream: true,
            messages: nonSystem.map((m) => ({
                role: m.role === 'tool' ? 'user' : m.role,
                content: m.role === 'tool'
                    ? [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]
                    : m.content,
            })),
        };

        if (systemMsg) {
            body.system = systemMsg.content;
        }

        if (options.tools && options.tools.length > 0) {
            body.tools = options.tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters,
            }));
        }

        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                yield { type: 'error', error: `Anthropic error ${res.status}: ${errText}` };
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                yield { type: 'error', error: 'No response body' };
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let currentToolId = '';
            let currentToolName = '';
            let currentToolArgs = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();

                    try {
                        const event = JSON.parse(data);

                        switch (event.type) {
                            case 'content_block_start':
                                if (event.content_block?.type === 'tool_use') {
                                    currentToolId = event.content_block.id;
                                    currentToolName = event.content_block.name;
                                    currentToolArgs = '';
                                }
                                break;

                            case 'content_block_delta':
                                if (event.delta?.type === 'text_delta') {
                                    yield { type: 'text', content: event.delta.text };
                                } else if (event.delta?.type === 'input_json_delta') {
                                    currentToolArgs += event.delta.partial_json;
                                }
                                break;

                            case 'content_block_stop':
                                if (currentToolId) {
                                    yield {
                                        type: 'tool_call',
                                        toolCall: {
                                            id: currentToolId,
                                            type: 'function',
                                            function: { name: currentToolName, arguments: currentToolArgs },
                                        },
                                    };
                                    currentToolId = '';
                                    currentToolName = '';
                                    currentToolArgs = '';
                                }
                                break;

                            case 'message_delta':
                                if (event.usage) {
                                    yield {
                                        type: 'done',
                                        usage: {
                                            promptTokens: event.usage.input_tokens || 0,
                                            completionTokens: event.usage.output_tokens || 0,
                                            totalTokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
                                        },
                                    };
                                }
                                break;

                            case 'message_stop':
                                yield { type: 'done' };
                                break;
                        }
                    } catch {
                        // Skip malformed SSE
                    }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, 'Anthropic request failed');
            yield { type: 'error', error: `Connection failed: ${err.message}` };
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }

    async listModels(): Promise<string[]> {
        return [
            'claude-sonnet-4-20250514',
            'claude-3-5-haiku-20241022',
            'claude-3-5-sonnet-20241022',
        ];
    }
}
