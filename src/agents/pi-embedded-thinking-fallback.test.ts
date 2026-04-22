/**
 * CoreBlow — PI Embedded Thinking Fallback Tests (Inline)
 *
 * Tests for pickFallbackThinkingLevel and extractSupportedValues logic.
 * Inline to avoid thinking.ts → auto-reply/thinking.js import chain.
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas of pure functions ──────────────────────────────

type ThinkLevel = 'off' | 'low' | 'medium' | 'high';

function normalizeThinkLevel(raw: string): ThinkLevel | undefined {
    const val = raw.trim().toLowerCase();
    if (val === 'off' || val === 'none' || val === 'disabled') return 'off';
    if (val === 'low' || val === 'brief') return 'low';
    if (val === 'medium' || val === 'med' || val === 'moderate') return 'medium';
    if (val === 'high' || val === 'deep' || val === 'full') return 'high';
    return undefined;
}

function extractSupportedValues(raw: string): string[] {
    const match =
        raw.match(/supported values are:\s*([^\n.]+)/i) ?? raw.match(/supported values:\s*([^\n.]+)/i);
    if (!match?.[1]) return [];
    const fragment = match[1];
    const quoted = Array.from(fragment.matchAll(/['"']([^'"]+)['"]/g)).map((entry) =>
        entry[1]?.trim(),
    );
    if (quoted.length > 0) return quoted.filter((entry): entry is string => Boolean(entry));
    return fragment
        .split(/,|\band\b/gi)
        .map((entry) => entry.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim())
        .filter(Boolean);
}

function pickFallbackThinkingLevel(params: {
    message?: string;
    attempted: Set<ThinkLevel>;
}): ThinkLevel | undefined {
    const raw = params.message?.trim();
    if (!raw) return undefined;
    const supported = extractSupportedValues(raw);
    if (supported.length === 0) {
        if (/not supported/i.test(raw) && !params.attempted.has('off')) return 'off';
        return undefined;
    }
    for (const entry of supported) {
        const normalized = normalizeThinkLevel(entry);
        if (!normalized) continue;
        if (params.attempted.has(normalized)) continue;
        return normalized;
    }
    return undefined;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('extractSupportedValues', () => {
    it('extracts quoted values', () => {
        expect(extractSupportedValues('Supported values are: "low", "medium", "high"'))
            .toEqual(['low', 'medium', 'high']);
    });

    it('extracts comma-separated values', () => {
        expect(extractSupportedValues('Supported values: low, medium, high'))
            .toEqual(['low', 'medium', 'high']);
    });

    it('returns empty for no match', () => {
        expect(extractSupportedValues('some random error')).toEqual([]);
    });
});

describe('pickFallbackThinkingLevel', () => {
    it('returns first unattempted supported level', () => {
        expect(pickFallbackThinkingLevel({
            message: 'Supported values are: "low", "high"',
            attempted: new Set<ThinkLevel>(),
        })).toBe('low');
    });

    it('skips already attempted levels', () => {
        expect(pickFallbackThinkingLevel({
            message: 'Supported values are: "low", "high"',
            attempted: new Set<ThinkLevel>(['low']),
        })).toBe('high');
    });

    it('returns "off" for "not supported" without listed values', () => {
        expect(pickFallbackThinkingLevel({
            message: 'think value "low" is not supported for this model',
            attempted: new Set<ThinkLevel>(),
        })).toBe('off');
    });

    it('returns undefined when "off" already attempted', () => {
        expect(pickFallbackThinkingLevel({
            message: 'think value is not supported',
            attempted: new Set<ThinkLevel>(['off']),
        })).toBeUndefined();
    });

    it('returns undefined for empty message', () => {
        expect(pickFallbackThinkingLevel({
            message: undefined,
            attempted: new Set<ThinkLevel>(),
        })).toBeUndefined();
    });

    it('returns undefined when all supported levels attempted', () => {
        expect(pickFallbackThinkingLevel({
            message: 'Supported values are: "low"',
            attempted: new Set<ThinkLevel>(['low']),
        })).toBeUndefined();
    });
});
