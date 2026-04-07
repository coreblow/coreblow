/**
 * CoreBlow Provider — Google Gemini
 *
 * Production adapter for Google's Gemini API (Gemini 2.5, 2.0, 1.5).
 * Translates between OpenAI-compatible format and Gemini's
 * generateContent API.
 */

import type { ModelProvider } from '../agents/runtime.js';

/** Gemini configuration */
export interface GeminiConfig {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
}

/** Gemini content part */
interface GeminiPart {
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: { content: string } };
}

/** Gemini response */
interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: GeminiPart[];
            role: string;
        };
        finishReason: string;
    }>;
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
        cachedContentTokenCount?: number;
    };
}

/** Available Gemini models */
export const GEMINI_MODELS = {
    'gemini-2.5-flash': { contextWindow: 1_048_576, outputTokens: 65_536, vision: true },
    'gemini-2.5-pro': { contextWindow: 1_048_576, outputTokens: 65_536, vision: true },
    'gemini-2.0-flash': { contextWindow: 1_048_576, outputTokens: 8_192, vision: true },
    'gemini-1.5-pro': { contextWindow: 2_097_152, outputTokens: 8_192, vision: true },
    'gemini-1.5-flash': { contextWindow: 1_048_576, outputTokens: 8_192, vision: true },
} as const;

/**
 * Gemini Provider
 */
export class GeminiProvider implements ModelProvider {
    readonly id = 'google';
    readonly name = 'Google Gemini';
    private config: GeminiConfig;

    constructor(config: GeminiConfig) {
        this.config = {
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            defaultModel: 'gemini-2.5-flash',
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
        const model = params.model || this.config.defaultModel || 'gemini-2.5-flash';

        // Convert messages to Gemini format
        let systemInstruction: string | undefined;
        const contents: Array<{ role: string; parts: GeminiPart[] }> = [];

        for (const msg of params.messages) {
            if (msg.role === 'system') {
                systemInstruction = msg.content;
            } else if (msg.role === 'user') {
                contents.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                contents.push({ role: 'model', parts: [{ text: msg.content }] });
            } else if (msg.role === 'tool') {
                contents.push({
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: msg.name ?? 'tool',
                            response: { content: msg.content },
                        },
                    }],
                });
            }
        }

        // Build request
        const body: Record<string, unknown> = { contents };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        if (params.temperature !== undefined) {
            body.generationConfig = {
                temperature: params.temperature,
                maxOutputTokens: params.max_tokens,
            };
        }

        // Convert tools
        if (params.tools?.length) {
            body.tools = [{
                functionDeclarations: params.tools.map((t) => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                })),
            }];
        }

        const endpoint = `/models/${model}:generateContent?key=${this.config.apiKey}`;
        const response = await this.request<GeminiResponse>(endpoint, body);
        const candidate = response.candidates[0]!;

        // Extract text
        const textParts = candidate.content.parts.filter((p) => p.text);
        const content = textParts.map((p) => p.text ?? '').join('');

        // Extract function calls
        const funcCalls = candidate.content.parts.filter((p) => p.functionCall);
        const toolCalls = funcCalls.length > 0
            ? funcCalls.map((p, i) => ({
                id: `call-${Date.now()}-${i}`,
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args),
            }))
            : undefined;

        return {
            content,
            toolCalls,
            usage: response.usageMetadata ? {
                input: response.usageMetadata.promptTokenCount,
                output: response.usageMetadata.candidatesTokenCount,
                total: response.usageMetadata.totalTokenCount,
                cacheRead: response.usageMetadata.cachedContentTokenCount,
            } : undefined,
            finishReason: candidate.finishReason,
        };
    }

    getModels(): string[] {
        return Object.keys(GEMINI_MODELS);
    }

    // === Private ===

    private async request<T>(endpoint: string, body: unknown): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Gemini API error ${res.status}: ${text}`);
            }

            return await res.json() as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
