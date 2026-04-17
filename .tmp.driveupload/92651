/**
 * auto-reply/thinking.test.ts — Thinking level tests
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeThinkLevel, isBinaryThinkingProvider,
    resolveThinkingDefaultForModel, resolveThinkingTokenBudget,
    listThinkingLevels, formatThinkingLevels,
    normalizeVerboseLevel, normalizeFastMode,
} from './thinking.js';

describe('Thinking Levels', () => {
    describe('normalizeThinkLevel', () => {
        it('normalizes none variants', () => {
            expect(normalizeThinkLevel('none')).toBe('none');
            expect(normalizeThinkLevel('off')).toBe('none');
            expect(normalizeThinkLevel('0')).toBe('none');
        });

        it('normalizes low variants', () => {
            expect(normalizeThinkLevel('low')).toBe('low');
            expect(normalizeThinkLevel('min')).toBe('low');
            expect(normalizeThinkLevel('1')).toBe('low');
        });

        it('normalizes medium', () => {
            expect(normalizeThinkLevel('medium')).toBe('medium');
            expect(normalizeThinkLevel('med')).toBe('medium');
        });

        it('normalizes high', () => expect(normalizeThinkLevel('high')).toBe('high'));
        it('normalizes max', () => expect(normalizeThinkLevel('max')).toBe('max'));
        it('returns undefined for unknown', () => expect(normalizeThinkLevel('unknown')).toBeUndefined());
        it('returns undefined for null', () => expect(normalizeThinkLevel(null)).toBeUndefined());
    });

    describe('isBinaryThinkingProvider', () => {
        it('anthropic is binary', () => expect(isBinaryThinkingProvider('anthropic')).toBe(true));
        it('claude is binary', () => expect(isBinaryThinkingProvider('claude')).toBe(true));
        it('deepseek is binary', () => expect(isBinaryThinkingProvider('deepseek')).toBe(true));
        it('openai is not binary', () => expect(isBinaryThinkingProvider('openai')).toBe(false));
        it('null returns false', () => expect(isBinaryThinkingProvider(null)).toBe(false));
    });

    describe('resolveThinkingDefaultForModel', () => {
        it('o1 defaults to high', () => expect(resolveThinkingDefaultForModel('o1-preview')).toBe('high'));
        it('claude-3-5 defaults to medium', () => expect(resolveThinkingDefaultForModel('claude-3-5-sonnet')).toBe('medium'));
        it('gpt-4o defaults to none', () => expect(resolveThinkingDefaultForModel('gpt-4o')).toBe('none'));
        it('null defaults to none', () => expect(resolveThinkingDefaultForModel(null)).toBe('none'));
    });

    describe('resolveThinkingTokenBudget', () => {
        it('none has no budget', () => expect(resolveThinkingTokenBudget('none')).toBeUndefined());
        it('low has 1024', () => expect(resolveThinkingTokenBudget('low')).toBe(1024));
        it('max has 65536', () => expect(resolveThinkingTokenBudget('max')).toBe(65536));
    });

    describe('listThinkingLevels', () => {
        it('returns 5 levels', () => expect(listThinkingLevels()).toHaveLength(5));
    });

    describe('formatThinkingLevels', () => {
        it('returns formatted string', () => {
            const result = formatThinkingLevels();
            expect(result).toContain('none');
            expect(result).toContain('max');
        });
    });

    describe('normalizeVerboseLevel', () => {
        it('normalizes off', () => expect(normalizeVerboseLevel('off')).toBe('off'));
        it('normalizes verbose to full', () => expect(normalizeVerboseLevel('verbose')).toBe('full'));
    });

    describe('normalizeFastMode', () => {
        it('true variants', () => {
            expect(normalizeFastMode('true')).toBe(true);
            expect(normalizeFastMode('on')).toBe(true);
        });
        it('false variants', () => {
            expect(normalizeFastMode('false')).toBe(false);
            expect(normalizeFastMode('off')).toBe(false);
        });
    });
});
