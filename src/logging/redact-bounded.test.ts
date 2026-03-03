import { describe, it, expect } from 'vitest';
import { replacePatternBounded, REDACT_REGEX_CHUNK_THRESHOLD, REDACT_REGEX_CHUNK_SIZE } from './redact-bounded.js';

describe('replacePatternBounded', () => {
    it('replaces pattern in short text (below threshold)', () => {
        const result = replacePatternBounded('my-secret-key-123', /secret/g, '***' as any);
        expect(result).toBe('my-***-key-123');
    });

    it('replaces all occurrences', () => {
        const result = replacePatternBounded('abc abc abc', /abc/g, 'x' as any);
        expect(result).toBe('x x x');
    });

    it('handles text below chunk threshold normally', () => {
        const text = 'short text with secret';
        const result = replacePatternBounded(text, /secret/g, '[REDACTED]' as any);
        expect(result).toBe('short text with [REDACTED]');
    });

    it('chunks large text above threshold', () => {
        const chunk = 'token-abc '.repeat(5000); // ~50000 chars
        const result = replacePatternBounded(chunk, /token/g, '***' as any, {
            chunkThreshold: 100,
            chunkSize: 50,
        });
        expect(result).toContain('***');
        expect(result).not.toContain('token');
    });

    it('uses default thresholds', () => {
        expect(REDACT_REGEX_CHUNK_THRESHOLD).toBe(32_768);
        expect(REDACT_REGEX_CHUNK_SIZE).toBe(16_384);
    });

    it('handles no matches', () => {
        const result = replacePatternBounded('clean text', /secret/g, '***' as any);
        expect(result).toBe('clean text');
    });

    it('handles empty text', () => {
        expect(replacePatternBounded('', /x/g, 'y' as any)).toBe('');
    });
});
