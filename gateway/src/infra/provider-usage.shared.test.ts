/**
 * infra/provider-usage.shared.test.ts — Provider usage accounting tests
 */
import { describe, it, expect } from 'vitest';
import { estimateCost, aggregateByProvider, formatCost } from './provider-usage.shared.js';

describe('Provider Usage', () => {
    it('should estimate cost', () => {
        const cost = estimateCost(1000, 500, 0.01, 0.03);
        expect(cost).toBeCloseTo(0.025);
    });

    it('should aggregate by provider', () => {
        const records = [
            { provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 50, costUsd: 0.01, timestamp: Date.now() },
            { provider: 'openai', model: 'gpt-4o', inputTokens: 200, outputTokens: 100, costUsd: 0.02, timestamp: Date.now() },
            { provider: 'anthropic', model: 'claude', inputTokens: 500, outputTokens: 200, costUsd: 0.05, timestamp: Date.now() },
        ];
        const agg = aggregateByProvider(records);
        expect(agg.openai.count).toBe(2);
        expect(agg.openai.totalCost).toBeCloseTo(0.03);
        expect(agg.anthropic.count).toBe(1);
    });

    it('should format cost', () => {
        expect(formatCost(0.0123)).toBe('$0.0123');
        expect(formatCost(1.5)).toBe('$1.5000');
    });
});
