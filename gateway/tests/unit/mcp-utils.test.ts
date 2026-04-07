/**
 * Tests: MCP Channel Types — Utilities
 */
import { describe, it, expect } from 'vitest';
import {
    toText,
    resolveMessageId,
    summarizeResult,
    extractAttachmentsFromMessage,
    normalizeApprovalId,
} from '../../src/mcp/channel-types.js';

// toText only accepts strings (returns undefined for non-string)
describe('toText', () => {
    it('converts non-empty string', () => {
        expect(toText('hello')).toBe('hello');
    });

    it('trims whitespace', () => {
        expect(toText('  spaced  ')).toBe('spaced');
    });

    it('returns undefined for empty string', () => {
        expect(toText('')).toBeUndefined();
    });

    it('returns undefined for number', () => {
        expect(toText(42)).toBeUndefined();
    });

    it('returns undefined for null', () => {
        expect(toText(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
        expect(toText(undefined)).toBeUndefined();
    });
});

// resolveMessageId checks entry.id or entry.__coreblow.id
describe('resolveMessageId', () => {
    it('resolves from id field', () => {
        expect(resolveMessageId({ id: 'msg-123' })).toBe('msg-123');
    });

    it('resolves from __coreblow.id', () => {
        expect(resolveMessageId({ __coreblow: { id: 'nested-456' } })).toBe('nested-456');
    });

    it('returns undefined for empty object', () => {
        expect(resolveMessageId({})).toBeUndefined();
    });

    it('returns undefined for numeric id', () => {
        expect(resolveMessageId({ id: 123 })).toBeUndefined();
    });
});

describe('summarizeResult', () => {
    it('returns formatted content', () => {
        const result = summarizeResult('Messages', 5);
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('5');
    });

    it('handles zero count', () => {
        const result = summarizeResult('Items', 0);
        expect(result.content[0].text).toContain('0');
    });
});

describe('extractAttachmentsFromMessage', () => {
    it('returns empty for no attachments', () => {
        expect(extractAttachmentsFromMessage({})).toEqual([]);
    });

    it('handles null message', () => {
        expect(extractAttachmentsFromMessage(null)).toEqual([]);
    });
});

describe('normalizeApprovalId', () => {
    it('normalizes string value', () => {
        expect(normalizeApprovalId('abc-123')).toBe('abc-123');
    });

    it('returns undefined for non-string', () => {
        expect(normalizeApprovalId(null)).toBeUndefined();
    });

    it('returns undefined for empty', () => {
        expect(normalizeApprovalId('')).toBeUndefined();
    });
});
