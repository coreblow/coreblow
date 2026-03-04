/**
 * src/providers/openrouter.ts
 * OpenRouter provider — 200+ models via single API
 */

import { createChildLogger } from '../utils/logger.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';

const log = createChildLogger('provider:openrouter');

export class OpenRouterProvider implements AIProvider {
    name = 'openrouter';
    private apiKey: string;

    constructor(opts: { apiKey?: string } = {}) {
        this.apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY || '';
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const model = options.model || 'anthropic/claude-3.5-sonnet';

        const body: Record<string, any> = {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            stream: true,
        };

        if (options.tools?.length) {
            body.tools = options.tools.map(t => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
            }));
        }

        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://coreblow.com',
                    'X-Title': 'CoreBlow AI Gateway',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                yield { type: 'error', error: `OpenRouter ${res.status}: ${err}` };
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
                                    yield { type: 'tool_call', toolCall: { id: tc.id, name: tc.function.name, arguments: JSON.parse(tc.function.arguments || '{}') } };
                                }
                            }
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (err: any) {
            log.error({ err: err.message }, 'OpenRouter error');
            yield { type: 'error', error: err.message };
        }
    }
}
