/**
 * CoreBlow — PI Embedded Messaging Dedupe Tests
 *
 * Tests for normalizeTextForComparison, isMessagingToolDuplicateNormalized,
 * and isMessagingToolDuplicate.
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeTextForComparison,
    isMessagingToolDuplicateNormalized,
    isMessagingToolDuplicate,
} from './pi-embedded-helpers/messaging-dedupe.js';

describe('normalizeTextForComparison', () => {
    it('trims and lowercases', () => {
        expect(normalizeTextForComparison('  Hello World  ')).toBe('hello world');
    });

    it('strips emoji', () => {
        const result = normalizeTextForComparison('hello 👋 world 🌍');
        expect(result).toBe('hello world');
    });

    it('collapses whitespace', () => {
        expect(normalizeTextForComparison('hello   world')).toBe('hello world');
    });

    it('handles empty string', () => {
        expect(normalizeTextForComparison('')).toBe('');
    });
});

describe('isMessagingToolDuplicateNormalized', () => {
    it('detects exact duplicate', () => {
        expect(isMessagingToolDuplicateNormalized(
            'this is a duplicate message',
            ['this is a duplicate message']
        )).toBe(true);
    });

    it('detects substring duplicate', () => {
        expect(isMessagingToolDuplicateNormalized(
            'this is a longer message with content',
            ['a longer message']
        )).toBe(true);
    });

    it('returns false for empty sentTexts', () => {
        expect(isMessagingToolDuplicateNormalized('some text here', [])).toBe(false);
    });

    it('returns false for short text (< 10 chars)', () => {
        expect(isMessagingToolDuplicateNormalized('short', ['short'])).toBe(false);
    });

    it('returns false for no match', () => {
        expect(isMessagingToolDuplicateNormalized(
            'completely different text here',
            ['something else entirely here']
        )).toBe(false);
    });
});

describe('isMessagingToolDuplicate', () => {
    it('normalizes and dedupes', () => {
        expect(isMessagingToolDuplicate(
            'Hello World this is test',
            ['hello world this is test']
        )).toBe(true);
    });

    it('strips emoji before comparing', () => {
        expect(isMessagingToolDuplicate(
            'hello world test message 👋',
            ['hello world test message']
        )).toBe(true);
    });

    it('returns false for unique messages', () => {
        expect(isMessagingToolDuplicate(
            'first message here longer',
            ['second message here longer']
        )).toBe(false);
    });

    it('returns false for empty sentTexts', () => {
        expect(isMessagingToolDuplicate('any text here', [])).toBe(false);
    });
});
