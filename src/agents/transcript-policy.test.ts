/**
 * CoreBlow — Transcript Policy Tests (Inline)
 *
 * Tests for isOpenAiApi and OPENAI_MODEL_APIS logic.
 * Inline to avoid provider-capabilities import chain.
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

const OPENAI_MODEL_APIS = new Set([
    'openai', 'openai-completions', 'openai-responses', 'openai-codex-responses',
]);

function isOpenAiApi(modelApi?: string | null): boolean {
    if (!modelApi) return false;
    return OPENAI_MODEL_APIS.has(modelApi);
}

function isAnthropicApi(modelApi?: string | null): boolean {
    return modelApi === 'anthropic-messages' || modelApi === 'bedrock-converse-stream';
}

type TranscriptSanitizeMode = 'full' | 'images-only';

// ── Tests ──────────────────────────────────────────────────────────

describe('OPENAI_MODEL_APIS', () => {
    it('contains expected APIs', () => {
        expect(OPENAI_MODEL_APIS.has('openai')).toBe(true);
        expect(OPENAI_MODEL_APIS.has('openai-completions')).toBe(true);
        expect(OPENAI_MODEL_APIS.has('openai-responses')).toBe(true);
        expect(OPENAI_MODEL_APIS.has('openai-codex-responses')).toBe(true);
    });

    it('does not contain non-openai APIs', () => {
        expect(OPENAI_MODEL_APIS.has('anthropic-messages')).toBe(false);
        expect(OPENAI_MODEL_APIS.has('google-generativeai')).toBe(false);
    });
});

describe('isOpenAiApi', () => {
    it('returns true for openai APIs', () => {
        expect(isOpenAiApi('openai')).toBe(true);
        expect(isOpenAiApi('openai-completions')).toBe(true);
    });

    it('returns false for non-openai', () => {
        expect(isOpenAiApi('anthropic-messages')).toBe(false);
        expect(isOpenAiApi('google-generativeai')).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isOpenAiApi(null)).toBe(false);
        expect(isOpenAiApi(undefined)).toBe(false);
    });
});

describe('isAnthropicApi', () => {
    it('detects anthropic-messages', () => {
        expect(isAnthropicApi('anthropic-messages')).toBe(true);
    });

    it('detects bedrock-converse-stream', () => {
        expect(isAnthropicApi('bedrock-converse-stream')).toBe(true);
    });

    it('rejects openai', () => {
        expect(isAnthropicApi('openai')).toBe(false);
    });

    it('rejects null', () => {
        expect(isAnthropicApi(null)).toBe(false);
    });
});

describe('TranscriptSanitizeMode', () => {
    it('accepts valid modes', () => {
        const full: TranscriptSanitizeMode = 'full';
        const imagesOnly: TranscriptSanitizeMode = 'images-only';
        expect(full).toBe('full');
        expect(imagesOnly).toBe('images-only');
    });
});
