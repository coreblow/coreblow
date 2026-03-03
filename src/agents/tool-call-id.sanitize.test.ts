import { describe, it, expect } from 'vitest';
import { sanitizeToolCallId, isValidCloudCodeAssistToolId } from './tool-call-id.js';

describe('sanitizeToolCallId — strict mode', () => {
    it('keeps alphanumeric ID unchanged', () => {
        expect(sanitizeToolCallId('abc123')).toBe('abc123');
    });

    it('strips non-alphanumeric characters', () => {
        expect(sanitizeToolCallId('call_abc-123')).toBe('callabc123');
    });

    it('returns default for empty string', () => {
        expect(sanitizeToolCallId('')).toBe('defaulttoolid');
    });

    it('returns sanitizedtoolid when all chars stripped', () => {
        expect(sanitizeToolCallId('---')).toBe('sanitizedtoolid');
    });
});

describe('sanitizeToolCallId — strict9 mode', () => {
    it('truncates to 9 chars', () => {
        const result = sanitizeToolCallId('abcdefghijklmnop', 'strict9');
        expect(result).toHaveLength(9);
        expect(result).toBe('abcdefghi');
    });

    it('returns default for empty input', () => {
        expect(sanitizeToolCallId('', 'strict9')).toBe('defaultid');
    });

    it('hashes short alphanumeric input', () => {
        const result = sanitizeToolCallId('ab', 'strict9');
        expect(result).toHaveLength(9);
    });

    it('hashes when all non-alphanumeric', () => {
        const result = sanitizeToolCallId('---', 'strict9');
        expect(result).toHaveLength(9);
    });
});

describe('isValidCloudCodeAssistToolId', () => {
    it('validates strict mode', () => {
        expect(isValidCloudCodeAssistToolId('abc123')).toBe(true);
        expect(isValidCloudCodeAssistToolId('ABC')).toBe(true);
    });

    it('rejects non-alphanumeric in strict mode', () => {
        expect(isValidCloudCodeAssistToolId('abc-123')).toBe(false);
        expect(isValidCloudCodeAssistToolId('abc_123')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidCloudCodeAssistToolId('')).toBe(false);
    });

    it('validates strict9 mode — exact 9 alphanumeric', () => {
        expect(isValidCloudCodeAssistToolId('abcdefghi', 'strict9')).toBe(true);
        expect(isValidCloudCodeAssistToolId('abc', 'strict9')).toBe(false);
        expect(isValidCloudCodeAssistToolId('abcdefghij', 'strict9')).toBe(false);
    });

    it('rejects non-alphanumeric in strict9', () => {
        expect(isValidCloudCodeAssistToolId('abc-defgh', 'strict9')).toBe(false);
    });
});
