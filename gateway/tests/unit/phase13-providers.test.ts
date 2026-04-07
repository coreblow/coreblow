/**
 * CoreBlow Phase 13 — AI Provider Integration Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIProvider, OPENAI_MODELS } from '../../src/providers/openai.js';
import { AnthropicProvider, ANTHROPIC_MODELS } from '../../src/providers/anthropic.js';
import { GeminiProvider, GEMINI_MODELS } from '../../src/providers/gemini.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { UsageTracker } from '../../src/providers/provider-usage.js';
import type { ModelProvider } from '../../src/agents/runtime.js';

// === Mock provider for registry tests ===
function mockProvider(id: string, name: string): ModelProvider {
    return {
        id,
        name,
        chat: async () => ({ content: 'mock', usage: { input: 10, output: 20, total: 30 } }),
    };
}

// ================================================================
// OpenAI Provider Tests
// ================================================================
describe('OpenAI Provider', () => {
    it('should create with config', () => {
        const provider = new OpenAIProvider({ apiKey: 'test' });
        expect(provider.id).toBe('openai');
        expect(provider.name).toBe('OpenAI');
    });

    it('should list available models', () => {
        const provider = new OpenAIProvider({ apiKey: 'test' });
        const models = provider.getModels();
        expect(models).toContain('gpt-4o');
        expect(models).toContain('gpt-4o-mini');
        expect(models).toContain('o1');
    });

    it('should have correct model metadata', () => {
        expect(OPENAI_MODELS['gpt-4o'].contextWindow).toBe(128_000);
        expect(OPENAI_MODELS['gpt-4o'].vision).toBe(true);
        expect(OPENAI_MODELS['gpt-3.5-turbo'].vision).toBe(false);
    });
});

// ================================================================
// Anthropic Provider Tests
// ================================================================
describe('Anthropic Provider', () => {
    it('should create with config', () => {
        const provider = new AnthropicProvider({ apiKey: 'test' });
        expect(provider.id).toBe('anthropic');
        expect(provider.name).toBe('Anthropic');
    });

    it('should list available models', () => {
        const provider = new AnthropicProvider({ apiKey: 'test' });
        const models = provider.getModels();
        expect(models).toContain('claude-sonnet-4-20250514');
        expect(models).toContain('claude-3-opus-20240229');
    });

    it('should have correct model metadata', () => {
        expect(ANTHROPIC_MODELS['claude-3-opus-20240229'].contextWindow).toBe(200_000);
        expect(ANTHROPIC_MODELS['claude-sonnet-4-20250514'].vision).toBe(true);
    });
});

// ================================================================
// Gemini Provider Tests
// ================================================================
describe('Gemini Provider', () => {
    it('should create with config', () => {
        const provider = new GeminiProvider({ apiKey: 'test' });
        expect(provider.id).toBe('google');
        expect(provider.name).toBe('Google Gemini');
    });

    it('should list available models', () => {
        const provider = new GeminiProvider({ apiKey: 'test' });
        const models = provider.getModels();
        expect(models).toContain('gemini-2.5-flash');
        expect(models).toContain('gemini-2.5-pro');
    });

    it('should have massive context windows', () => {
        expect(GEMINI_MODELS['gemini-2.5-flash'].contextWindow).toBe(1_048_576);
        expect(GEMINI_MODELS['gemini-1.5-pro'].contextWindow).toBe(2_097_152);
    });
});

// ================================================================
// Provider Registry Tests
// ================================================================
describe('ProviderRegistry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => {
        registry = new ProviderRegistry();
    });

    it('should register providers', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o', 'gpt-4o-mini'], 10);
        expect(registry.list()).toHaveLength(1);
    });

    it('should route model to provider', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o'], 10);
        const route = registry.route('gpt-4o');
        expect(route).not.toBeNull();
        expect(route!.provider.id).toBe('openai');
    });

    it('should handle unknown model with default', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o'], 10);
        const route = registry.route('unknown-model');
        expect(route).not.toBeNull(); // Falls back to default
    });

    it('should select by priority', () => {
        registry.register(mockProvider('low', 'Low'), ['model-a'], 1);
        registry.register(mockProvider('high', 'High'), ['model-a'], 10);
        const route = registry.route('model-a');
        expect(route!.provider.id).toBe('high');
    });

    it('should skip disabled providers', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o'], 10);
        registry.setEnabled('openai', false);
        const route = registry.route('gpt-4o');
        expect(route).toBeNull();
    });

    it('should skip unhealthy providers', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o'], 10);
        registry.setHealthy('openai', false);
        const route = registry.route('gpt-4o');
        expect(route).toBeNull();
    });

    it('should provide fallbacks', () => {
        registry.register(mockProvider('primary', 'Primary'), ['model-x'], 10);
        registry.register(mockProvider('backup', 'Backup'), ['model-x'], 5);
        const route = registry.route('model-x');
        expect(route!.fallbacks).toHaveLength(1);
        expect(route!.fallbacks[0]!.id).toBe('backup');
    });

    it('should list all models', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o', 'gpt-4o-mini']);
        registry.register(mockProvider('anthropic', 'Anthropic'), ['claude-3-opus']);
        const models = registry.listModels();
        expect(models).toHaveLength(3);
    });

    it('should set default provider', () => {
        registry.register(mockProvider('a', 'A'), ['model-a']);
        registry.register(mockProvider('b', 'B'), ['model-b']);
        registry.setDefault('b');
        const route = registry.route('unknown');
        expect(route!.provider.id).toBe('b');
    });

    it('should get provider by ID', () => {
        registry.register(mockProvider('openai', 'OpenAI'), ['gpt-4o']);
        expect(registry.get('openai')?.id).toBe('openai');
        expect(registry.get('nope')).toBeNull();
    });
});

// ================================================================
// Usage Tracker Tests
// ================================================================
describe('UsageTracker', () => {
    let tracker: UsageTracker;

    beforeEach(() => {
        tracker = new UsageTracker();
    });

    it('should record usage', () => {
        const record = tracker.record({
            provider: 'openai',
            model: 'gpt-4o',
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
            latencyMs: 500,
            success: true,
        });
        expect(record.timestamp).toBeGreaterThan(0);
        expect(record.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should calculate cost for gpt-4o', () => {
        const record = tracker.record({
            provider: 'openai',
            model: 'gpt-4o',
            inputTokens: 1_000_000,
            outputTokens: 1_000_000,
            totalTokens: 2_000_000,
            latencyMs: 1000,
            success: true,
        });
        // $2.50 input + $10 output = $12.50
        expect(record.estimatedCostUsd).toBeCloseTo(12.5, 1);
    });

    it('should get aggregate stats', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 500, success: true });
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 150, outputTokens: 250, totalTokens: 400, latencyMs: 300, success: true });

        const stats = tracker.getStats();
        expect(stats.totalRequests).toBe(2);
        expect(stats.totalTokens).toBe(700);
        expect(stats.avgLatencyMs).toBe(400);
    });

    it('should filter stats by provider', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 500, success: true });
        tracker.record({ provider: 'anthropic', model: 'claude-3-opus', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 600, success: true });

        const stats = tracker.getStats({ provider: 'openai' });
        expect(stats.totalRequests).toBe(1);
    });

    it('should get model breakdown', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 500, success: true });
        tracker.record({ provider: 'openai', model: 'gpt-4o-mini', inputTokens: 50, outputTokens: 100, totalTokens: 150, latencyMs: 200, success: true });

        const breakdown = tracker.getModelBreakdown();
        expect(breakdown).toHaveLength(2);
    });

    it('should track errors', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 0, totalTokens: 100, latencyMs: 50, success: false });
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 500, success: true });

        const stats = tracker.getStats();
        expect(stats.errorCount).toBe(1);
        expect(stats.errorRate).toBe(0.5);
    });

    it('should get total cost', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, latencyMs: 500, success: true });
        const cost = tracker.getTotalCost();
        expect(cost).toBeGreaterThan(0);
    });

    it('should reset', () => {
        tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 200, totalTokens: 300, latencyMs: 500, success: true });
        tracker.reset();
        expect(tracker.getStats().totalRequests).toBe(0);
    });
});
