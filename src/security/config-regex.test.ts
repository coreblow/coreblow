/**
 * CoreBlow — Config Regex Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./safe-regex.js', () => ({
    compileSafeRegexDetailed: (source: string, flags: string) => {
        if (source === '') return { regex: null, source, flags, reason: 'empty' as const };
        if (source === '[invalid') return { regex: null, source, flags, reason: 'syntax' as const };
        if (source === '(a+)+$') return { regex: null, source, flags, reason: 'unsafe' as const };
        return { regex: new RegExp(source, flags), source, flags, reason: null };
    },
}));

import { compileConfigRegex, compileConfigRegexes } from './config-regex.js';

describe('compileConfigRegex', () => {
    it('should compile a valid pattern', () => {
        const result = compileConfigRegex('hello', 'i');
        expect(result).not.toBeNull();
        expect(result!.regex).toBeInstanceOf(RegExp);
        expect(result!.pattern).toBe('hello');
        expect(result!.flags).toBe('i');
        expect(result!.reason).toBeNull();
    });

    it('should return null for empty pattern', () => {
        expect(compileConfigRegex('')).toBeNull();
    });

    it('should return rejected result for syntax error', () => {
        const result = compileConfigRegex('[invalid');
        expect(result).not.toBeNull();
        expect(result!.regex).toBeNull();
        expect(result!.reason).toBe('syntax');
    });

    it('should return rejected result for unsafe regex', () => {
        const result = compileConfigRegex('(a+)+$');
        expect(result).not.toBeNull();
        expect(result!.regex).toBeNull();
        expect(result!.reason).toBe('unsafe');
    });

    it('should default to empty flags', () => {
        const result = compileConfigRegex('test');
        expect(result!.flags).toBe('');
    });
});

describe('compileConfigRegexes', () => {
    it('should compile valid patterns and collect regexes', () => {
        const { regexes, rejected } = compileConfigRegexes(['foo', 'bar', 'baz']);
        expect(regexes).toHaveLength(3);
        expect(rejected).toHaveLength(0);
    });

    it('should skip empty patterns', () => {
        const { regexes, rejected } = compileConfigRegexes(['', 'foo', '']);
        expect(regexes).toHaveLength(1);
        expect(rejected).toHaveLength(0);
    });

    it('should collect rejected patterns', () => {
        const { regexes, rejected } = compileConfigRegexes(['foo', '[invalid', '(a+)+$']);
        expect(regexes).toHaveLength(1);
        expect(rejected).toHaveLength(2);
        expect(rejected[0].reason).toBe('syntax');
        expect(rejected[1].reason).toBe('unsafe');
    });

    it('should pass flags to all patterns', () => {
        const { regexes } = compileConfigRegexes(['test'], 'gi');
        expect(regexes[0].flags).toContain('g');
        expect(regexes[0].flags).toContain('i');
    });

    it('should handle empty array', () => {
        const { regexes, rejected } = compileConfigRegexes([]);
        expect(regexes).toHaveLength(0);
        expect(rejected).toHaveLength(0);
    });
});
