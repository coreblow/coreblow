/**
 * src/providers/gemini.ts
 * Google Gemini provider — gemini-pro, gemini-1.5-flash, gemini-2.0
 * All code is 100% original, inspired by public Gemini API docs
 */

import { createChildLogger } from '../utils/logger.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk, ChatResponse } from './interface.js';

const log = createChildLogger('provider:gemini');

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    private apiKey: string;
    private baseUrl: string;

    constructor(opts: { apiKey?: string; baseUrl?: string } = {}) {
        this.apiKey = opts.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        this.baseUrl = opts.baseUrl || GEMINI_API;
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        const model = options.model || 'gemini-1.5-flash';
        const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

        // Convert messages to Gemini format
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const systemInstruction = messages.find(m => m.role === 'system');

        const body: Record<string, any> = {
            contents,
            generationConfig: {
                maxOutputTokens: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
        }

        // Add tools if provided
        if (options.tools?.length) {
            body.tools = [{
                functionDeclarations: options.tools.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                })),
            }];
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                log.error({ status: res.status, err }, 'Gemini API error');
                yield { type: 'error', error: `Gemini ${res.status}: ${err}` };
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';
            let totalTokens = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const candidate = json.candidates?.[0];
                        if (!candidate) continue;

                        // Text content
                        const parts = candidate.content?.parts || [];
                        for (const part of parts) {
                            if (part.text) {
                                yield { type: 'text', content: part.text };
                            }
                            if (part.functionCall) {
                                yield {
                                    type: 'tool_call',
                                    toolCall: {
                                        id: `gemini_${Date.now()}`,
                                        type: 'function',
                                        function: {
                                            name: part.functionCall.name,
                                            arguments: JSON.stringify(part.functionCall.args || {}),
                                        },
                                    },
                                };
                            }
                        }

                        // Usage
                        if (json.usageMetadata) {
                            totalTokens = json.usageMetadata.totalTokenCount || 0;
                        }
                    } catch { /* skip malformed */ }
                }
            }

            yield {
                type: 'done',
                usage: {
                    promptTokens: 0,
                    completionTokens: totalTokens,
                    totalTokens,
                },
            };
        } catch (err: any) {
            log.error({ err: err.message }, 'Gemini connection error');
            yield { type: 'error', error: err.message };
        }
    }

    async isAvailable(): Promise<boolean> { return Boolean(this.apiKey); }
    listModels(): string[] { return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']; }
}
