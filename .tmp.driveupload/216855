/**
 * auto-reply/model-runtime.test.ts — Model runtime tests
 */
import { describe, it, expect } from 'vitest';
import {
    parseModelString, resolveModelConfig, resolveModelFallbackChain,
    estimateTokenCount, truncateContextToFit,
} from './model-runtime.js';

describe('Model Runtime', () => {
    describe('parseModelString', () => {
        it('parses provider/model', () => {
            const { provider, modelId } = parseModelString('openai/gpt-4o');
            expect(provider).toBe('openai');
            expect(modelId).toBe('gpt-4o');
        });

        it('infers OpenAI for gpt-*', () => {
            expect(parseModelString('gpt-4o').provider).toBe('openai');
        });

        it('infers Anthropic for claude-*', () => {
            expect(parseModelString('claude-3.5-sonnet').provider).toBe('anthropic');
        });

        it('infers Google for gemini-*', () => {
            expect(parseModelString('gemini-2.5-pro').provider).toBe('google');
        });

        it('infers OpenAI o-series', () => {
            expect(parseModelString('o3-mini').provider).toBe('openai');
        });

        it('defaults to openai for unknown', () => {
            expect(parseModelString('custom-model').provider).toBe('openai');
        });
    });

    describe('resolveModelConfig', () => {
        it('resolves default model', () => {
            const cfg = { agents: { defaults: { model: 'gpt-4o' } } };
            const result = resolveModelConfig(cfg);
            expect(result?.provider).toBe('openai');
            expect(result?.modelId).toBe('gpt-4o');
        });

        it('returns null when no model configured', () => {
            expect(resolveModelConfig({})).toBeNull();
        });
    });

    describe('resolveModelFallbackChain', () => {
        it('includes primary and fallbacks', () => {
            const cfg = { agents: { defaults: { model: 'gpt-4o', fallbackModels: ['claude-3.5-sonnet', 'gemini-pro'] } } };
            const chain = resolveModelFallbackChain(cfg);
            expect(chain?.primary.modelId).toBe('gpt-4o');
            expect(chain?.fallbacks).toHaveLength(2);
        });

        it('returns null when no model', () => {
            expect(resolveModelFallbackChain({})).toBeNull();
        });
    });

    describe('estimateTokenCount', () => {
        it('estimates ~4 chars per token', () => {
            expect(estimateTokenCount('1234')).toBe(1);
            expect(estimateTokenCount('12345678')).toBe(2);
        });
    });

    describe('truncateContextToFit', () => {
        it('keeps all messages if within budget', () => {
            const messages = [
                { role: 'system', content: 'You are helpful.' },
                { role: 'user', content: 'Hi' },
            ];
            const result = truncateContextToFit(messages, 100);
            expect(result).toHaveLength(2);
        });

        it('truncates old messages', () => {
            const messages = [
                { role: 'system', content: 'S' },
                { role: 'user', content: 'A'.repeat(100) },
                { role: 'assistant', content: 'B'.repeat(100) },
                { role: 'user', content: 'C'.repeat(100) },
                { role: 'user', content: 'Latest' },
            ];
            const result = truncateContextToFit(messages, 50);
            expect(result[0].role).toBe('system');
            expect(result[result.length - 1].content).toBe('Latest');
        });
    });
});
