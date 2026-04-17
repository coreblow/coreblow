/**
 * agents/agent-engine.live.test.ts
 * Live tests — calls real LLM APIs.
 * Only runs when COREBLOW_LIVE_TEST=1 is set.
 * Follows OpenClaw's live-test-helpers.ts pattern.
 */
import { describe, expect, it } from 'vitest';
import { AgentEngine } from './agent-engine.js';
import { registerBuiltinTools } from './tool-definitions.js';
import { isLiveTestEnabled, LIVE_OK_PROMPT } from './test-helpers/e2e-fixtures.js';
import type { ModelProvider, TokenUsage } from './runtime.js';

const LIVE = isLiveTestEnabled();
const describeLive = LIVE ? describe : describe.skip;

// ─── Real Anthropic Provider ─────────────────────────────────────

function createRealAnthropicProvider(): ModelProvider | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    return {
        id: 'anthropic',
        name: 'Anthropic',
        chat: async (params) => {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: params.model,
                    max_tokens: params.max_tokens ?? 256,
                    messages: params.messages.map(m => ({
                        role: m.role === 'system' ? 'user' : m.role,
                        content: m.content,
                    })).filter(m => m.role !== 'system'),
                    system: params.messages.find(m => m.role === 'system')?.content,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Anthropic API error ${response.status}: ${text}`);
            }

            const data = await response.json() as {
                content: Array<{ type: string; text?: string }>;
                usage: { input_tokens: number; output_tokens: number };
                stop_reason: string;
            };

            const content = data.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text ?? '')
                .join('');

            return {
                content,
                usage: {
                    input: data.usage.input_tokens,
                    output: data.usage.output_tokens,
                    total: data.usage.input_tokens + data.usage.output_tokens,
                } as TokenUsage,
                finishReason: data.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn',
            };
        },
    };
}

// ─── Real OpenAI Provider ────────────────────────────────────────

function createRealOpenAIProvider(): ModelProvider | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    return {
        id: 'openai',
        name: 'OpenAI',
        chat: async (params) => {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: params.model,
                    max_tokens: params.max_tokens ?? 256,
                    messages: params.messages,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OpenAI API error ${response.status}: ${text}`);
            }

            const data = await response.json() as {
                choices: Array<{ message: { content: string }; finish_reason: string }>;
                usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
            };

            return {
                content: data.choices[0]?.message?.content ?? '',
                usage: {
                    input: data.usage.prompt_tokens,
                    output: data.usage.completion_tokens,
                    total: data.usage.total_tokens,
                } as TokenUsage,
                finishReason: data.choices[0]?.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
            };
        },
    };
}

// ─── Live Tests ──────────────────────────────────────────────────

describeLive('LIVE: Anthropic Integration', () => {
    it('sends a simple prompt and gets response', async () => {
        const provider = createRealAnthropicProvider();
        if (!provider) { console.log('Skipping: ANTHROPIC_API_KEY not set'); return; }

        const engine = new AgentEngine({ defaultProvider: 'anthropic' });
        engine.registerProvider(provider, true);
        const sid = engine.createSession({
            model: 'claude-3-5-haiku-20241022',
            systemPrompt: 'Reply with exactly one word.',
        });

        const result = await engine.runTurn(sid, LIVE_OK_PROMPT);
        expect(result.responseText.length).toBeGreaterThan(0);
        expect(result.responseText.toLowerCase()).toContain('ok');
        expect(result.usage.inputTokens).toBeGreaterThan(0);
        expect(result.usage.outputTokens).toBeGreaterThan(0);

        console.log(`[LIVE] Anthropic response: "${result.responseText}" (${result.usage.totalTokens} tokens, ${result.durationMs}ms)`);
        engine.shutdown();
    }, { timeout: 30_000 });
});

describeLive('LIVE: OpenAI Integration', () => {
    it('sends a simple prompt and gets response', async () => {
        const provider = createRealOpenAIProvider();
        if (!provider) { console.log('Skipping: OPENAI_API_KEY not set'); return; }

        const engine = new AgentEngine({ defaultProvider: 'openai' });
        engine.registerProvider(provider, true);
        const sid = engine.createSession({
            model: 'gpt-4o-mini',
            systemPrompt: 'Reply with exactly one word.',
        });

        const result = await engine.runTurn(sid, LIVE_OK_PROMPT);
        expect(result.responseText.length).toBeGreaterThan(0);
        expect(result.usage.inputTokens).toBeGreaterThan(0);

        console.log(`[LIVE] OpenAI response: "${result.responseText}" (${result.usage.totalTokens} tokens, ${result.durationMs}ms)`);
        engine.shutdown();
    }, { timeout: 30_000 });
});
