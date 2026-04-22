/**
 * CoreBlow — Live Model Filter Tests (Inline)
 *
 * Tests for isHighSignalClaudeModelId logic inline to avoid
 * import chain (resolveProviderModernModelRef → plugins).
 */

import { describe, it, expect } from 'vitest';

// ── Inline replica of pure inner function ──────────────────────────
function isHighSignalClaudeModelId(id: string): boolean {
    if (!/\bclaude\b/i.test(id)) return true;
    if (/\bhaiku\b/i.test(id)) return false;
    if (/\bclaude-3(?:[-.]5|[-.]7)\b/i.test(id)) return false;
    return true;
}

describe('isHighSignalClaudeModelId', () => {
    it('non-claude model IDs are high signal', () => {
        expect(isHighSignalClaudeModelId('gpt-4o')).toBe(true);
        expect(isHighSignalClaudeModelId('gemini-2-5-flash')).toBe(true);
        expect(isHighSignalClaudeModelId('deepseek-chat')).toBe(true);
    });

    it('claude-3.5 is NOT high signal', () => {
        expect(isHighSignalClaudeModelId('claude-3-5-sonnet')).toBe(false);
        expect(isHighSignalClaudeModelId('claude-3.5-sonnet')).toBe(false);
    });

    it('claude-3.7 is NOT high signal', () => {
        expect(isHighSignalClaudeModelId('claude-3-7-sonnet')).toBe(false);
    });

    it('haiku is NOT high signal', () => {
        expect(isHighSignalClaudeModelId('claude-3-5-haiku-latest')).toBe(false);
        expect(isHighSignalClaudeModelId('claude-haiku')).toBe(false);
    });

    it('claude sonnet-4 IS high signal', () => {
        expect(isHighSignalClaudeModelId('claude-sonnet-4-20250514')).toBe(true);
    });

    it('claude opus IS high signal', () => {
        expect(isHighSignalClaudeModelId('claude-opus-4-20250514')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isHighSignalClaudeModelId('CLAUDE-3-5-SONNET')).toBe(false);
        expect(isHighSignalClaudeModelId('GPT-4O')).toBe(true);
    });
});
