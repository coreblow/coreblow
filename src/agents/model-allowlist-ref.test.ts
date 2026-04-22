/**
 * CoreBlow — Model Allowlist Ref Tests (Inline)
 *
 * Tests for normalizeAnthropicModelId and modelKey logic.
 * Inline to avoid provider-id import chain.
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

function normalizeAnthropicModelId(model: string): string {
    const trimmed = model.trim();
    if (!trimmed) return trimmed;
    switch (trimmed.toLowerCase()) {
        case 'opus-4.6': return 'claude-opus-4-6';
        case 'opus-4.5': return 'claude-opus-4-5';
        case 'sonnet-4.6': return 'claude-sonnet-4-6';
        case 'sonnet-4.5': return 'claude-sonnet-4-5';
        default: return trimmed;
    }
}

function modelKey(provider: string, model: string): string {
    const providerId = provider.trim();
    const modelId = model.trim();
    if (!providerId) return modelId;
    if (!modelId) return providerId;
    return modelId.toLowerCase().startsWith(`${providerId.toLowerCase()}/`)
        ? modelId
        : `${providerId}/${modelId}`;
}

describe('normalizeAnthropicModelId', () => {
    it('normalizes opus-4.6 shorthand', () => {
        expect(normalizeAnthropicModelId('opus-4.6')).toBe('claude-opus-4-6');
    });

    it('normalizes opus-4.5 shorthand', () => {
        expect(normalizeAnthropicModelId('opus-4.5')).toBe('claude-opus-4-5');
    });

    it('normalizes sonnet-4.6 shorthand', () => {
        expect(normalizeAnthropicModelId('sonnet-4.6')).toBe('claude-sonnet-4-6');
    });

    it('normalizes sonnet-4.5 shorthand', () => {
        expect(normalizeAnthropicModelId('sonnet-4.5')).toBe('claude-sonnet-4-5');
    });

    it('passes through full model IDs', () => {
        expect(normalizeAnthropicModelId('claude-opus-4-6-20250514')).toBe('claude-opus-4-6-20250514');
    });

    it('handles empty string', () => {
        expect(normalizeAnthropicModelId('')).toBe('');
    });

    it('trims whitespace', () => {
        expect(normalizeAnthropicModelId('  opus-4.6  ')).toBe('claude-opus-4-6');
    });
});

describe('modelKey', () => {
    it('combines provider/model', () => {
        expect(modelKey('anthropic', 'claude-opus-4-6')).toBe('anthropic/claude-opus-4-6');
    });

    it('avoids double provider prefix', () => {
        expect(modelKey('anthropic', 'anthropic/claude-opus-4-6')).toBe('anthropic/claude-opus-4-6');
    });

    it('returns model only if provider empty', () => {
        expect(modelKey('', 'claude-opus-4-6')).toBe('claude-opus-4-6');
    });

    it('returns provider only if model empty', () => {
        expect(modelKey('anthropic', '')).toBe('anthropic');
    });

    it('is case-insensitive for prefix check', () => {
        expect(modelKey('OpenAI', 'openai/gpt-4o')).toBe('openai/gpt-4o');
    });
});
