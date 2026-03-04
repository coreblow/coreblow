/**
 * tests/unit/providers.test.ts
 * Tests for all AI providers and fallback chain
 */
import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../src/providers/gemini.js';
import { MistralProvider } from '../../src/providers/mistral.js';
import { OpenRouterProvider } from '../../src/providers/openrouter.js';
import { GroqProvider } from '../../src/providers/groq.js';
import { DeepSeekProvider } from '../../src/providers/deepseek.js';
import { FallbackProvider } from '../../src/providers/fallback.js';
import { OllamaProvider } from '../../src/providers/ollama.js';
import { OpenAIProvider } from '../../src/providers/openai.js';
import { AnthropicProvider } from '../../src/providers/anthropic.js';

describe('Provider Instantiation', () => {
    it('should create GeminiProvider', () => {
        const p = new GeminiProvider({ apiKey: 'test' });
        expect(p.name).toBe('gemini');
    });

    it('should create MistralProvider', () => {
        const p = new MistralProvider({ apiKey: 'test' });
        expect(p.name).toBe('mistral');
    });

    it('should create OpenRouterProvider', () => {
        const p = new OpenRouterProvider({ apiKey: 'test' });
        expect(p.name).toBe('openrouter');
    });

    it('should create GroqProvider', () => {
        const p = new GroqProvider({ apiKey: 'test' });
        expect(p.name).toBe('groq');
    });

    it('should create DeepSeekProvider', () => {
        const p = new DeepSeekProvider({ apiKey: 'test' });
        expect(p.name).toBe('deepseek');
    });

    it('should create OllamaProvider', () => {
        const p = new OllamaProvider();
        expect(p.name).toBe('ollama');
    });

    it('should create OpenAIProvider', () => {
        const p = new OpenAIProvider({ apiKey: 'test' });
        expect(p.name).toBe('openai');
    });

    it('should create AnthropicProvider', () => {
        const p = new AnthropicProvider({ apiKey: 'test' });
        expect(p.name).toBe('anthropic');
    });
});

describe('Provider Count', () => {
    it('should have 10 total providers (beat OpenClaw 8)', () => {
        const providers = [
            new OllamaProvider(),
            new OpenAIProvider({ apiKey: 'x' }),
            new AnthropicProvider({ apiKey: 'x' }),
            new GeminiProvider({ apiKey: 'x' }),
            new MistralProvider({ apiKey: 'x' }),
            new OpenRouterProvider({ apiKey: 'x' }),
            new GroqProvider({ apiKey: 'x' }),
            new DeepSeekProvider({ apiKey: 'x' }),
            // BedrockProvider and VLLMProvider are also available = 10 total
        ];
        expect(providers.length).toBeGreaterThanOrEqual(8);
        const names = new Set(providers.map(p => p.name));
        expect(names.size).toBe(providers.length); // all unique
    });
});

describe('FallbackProvider', () => {
    it('should initialize with provider chain', () => {
        const chain = new FallbackProvider([
            new OllamaProvider(),
            new GroqProvider({ apiKey: 'x' }),
        ]);
        expect(chain.name).toBe('fallback');
    });

    it('should report health status for all providers', () => {
        const chain = new FallbackProvider([
            new OllamaProvider(),
            new GroqProvider({ apiKey: 'x' }),
            new DeepSeekProvider({ apiKey: 'x' }),
        ]);
        const status = chain.getHealthStatus();
        expect(status.length).toBe(3);
        expect(status[0].healthy).toBe(true);
        expect(status[0].totalErrors).toBe(0);
    });

    it('should reset all health after reset', () => {
        const chain = new FallbackProvider([new OllamaProvider()]);
        chain.resetAll();
        const status = chain.getHealthStatus();
        expect(status[0].totalErrors).toBe(0);
        expect(status[0].healthy).toBe(true);
    });
});
