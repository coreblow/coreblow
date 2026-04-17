/**
 * Tests: Security — Safe Regex Engine (ReDoS Protection)
 * CoreBlow — safe-regex.test.ts + extended cases
 */
import { describe, it, expect } from 'vitest';
import {
    hasNestedRepetition,
    compileSafeRegex,
    compileSafeRegexDetailed,
    testRegexWithBoundedInput,
} from '../../src/security/safe-regex.js';

describe('hasNestedRepetition', () => {
    it.each([
        // [pattern, expected, description]
        ['(a+)+$', true, 'nested quantifier'],
        ['(a|aa)+$', true, 'ambiguous alternation with outer quantifier'],
        ['([0-9]+)*$', true, 'digits nested repetition'],
        ['(\\w+)+', true, 'word char class nested'],
        ['^(?:foo|bar)$', false, 'safe non-capturing group alternation'],
        ['^(ab|cd)+$', false, 'safe fixed-length alternation'],
        ['^agent:.*:discord:', false, 'safe wildcard pattern'],
        ['^[a-z]+$', false, 'safe char class'],
        ['\\d{3}-\\d{4}', false, 'safe bounded quantifier'],
        ['(a|aa){2}$', false, 'ambiguous alternation with fixed quantifier — safe'],
    ] as const)('classifies %s (expected=%s): %s', (pattern, expected) => {
        expect(hasNestedRepetition(pattern)).toBe(expected);
    });

    it('returns false for simple literal pattern', () => {
        expect(hasNestedRepetition('hello world')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(hasNestedRepetition('')).toBe(false);
    });
});

describe('compileSafeRegex', () => {
    it('returns null for unsafe nested repetition pattern', () => {
        expect(compileSafeRegex('(a+)+$')).toBeNull();
    });

    it('returns null for ambiguous alternation', () => {
        expect(compileSafeRegex('(a|aa)+$')).toBeNull();
    });

    it('returns RegExp for safe pattern', () => {
        const re = compileSafeRegex('^agent:.*:discord:');
        expect(re).toBeInstanceOf(RegExp);
    });

    it('compiled regex matches correctly', () => {
        const re = compileSafeRegex('^agent:.*:discord:');
        expect(re?.test('agent:main:discord:channel:123')).toBe(true);
        expect(re?.test('agent:main:telegram:channel:123')).toBe(false);
    });

    it('supports flags', () => {
        const re = compileSafeRegex('token=([A-Za-z0-9]+)', 'gi');
        expect(re).toBeInstanceOf(RegExp);
        expect('TOKEN=abcd1234'.replace(re as RegExp, '***')).toBe('***');
    });

    it('returns null for invalid regex syntax', () => {
        expect(compileSafeRegex('(invalid')).toBeNull();
    });

    it('returns null for empty/whitespace pattern', () => {
        expect(compileSafeRegex('')).toBeNull();
        expect(compileSafeRegex('   ')).toBeNull();
    });

    it('handles bounded quantifier safely', () => {
        const re = compileSafeRegex('(a|aa){2}$');
        expect(re).toBeInstanceOf(RegExp);
    });

    it('is case-insensitive with i flag', () => {
        const re = compileSafeRegex('^hello$', 'i');
        expect(re?.test('HELLO')).toBe(true);
    });
});

describe('compileSafeRegexDetailed', () => {
    it.each([
        ['   ', 'empty'],
        ['(a+)+$', 'unsafe-nested-repetition'],
        ['(invalid', 'invalid-regex'],
        ['^agent:main$', null],
        ['[a-z]+', null],
    ] as const)('reason for %s is %s', (pattern, expectedReason) => {
        expect(compileSafeRegexDetailed(pattern).reason).toBe(expectedReason);
    });

    it('returns source and flags on success', () => {
        const result = compileSafeRegexDetailed('^abc$', 'i');
        expect(result.source).toBe('^abc$');
        expect(result.flags).toBe('i');
        expect(result.reason).toBeNull();
        expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('caches results for same pattern+flags', () => {
        // Call twice — second should come from cache (no observable side effect to test
        // directly, but it should return the same result)
        const r1 = compileSafeRegexDetailed('^cached-pattern$');
        const r2 = compileSafeRegexDetailed('^cached-pattern$');
        expect(r1).toStrictEqual(r2);
    });

    it('differentiates cache by flags', () => {
        const r1 = compileSafeRegexDetailed('^abc$', '');
        const r2 = compileSafeRegexDetailed('^abc$', 'i');
        // Both should be valid but different regex instances
        expect(r1.regex?.flags).toBe('');
        expect(r2.regex?.flags).toContain('i');
    });
});

describe('testRegexWithBoundedInput', () => {
    it.each([
        [/^agent:main:discord:/, `agent:main:discord:${'x'.repeat(5000)}`, true, 'head match'],
        [/discord:tail$/, `${'x'.repeat(5000)}discord:tail`, true, 'tail match'],
        [/discord:tail$/, `${'x'.repeat(5000)}telegram:tail`, false, 'tail no-match'],
        [/^hello$/, 'hello', true, 'short string match'],
        [/^world$/, 'hello', false, 'short string no-match'],
    ] as const)('%s on input: %s', (pattern, input, expected) => {
        expect(testRegexWithBoundedInput(pattern, input)).toBe(expected);
    });

    it('returns false when maxWindow is 0', () => {
        expect(testRegexWithBoundedInput(/.*/, 'anything', 0)).toBe(false);
    });

    it('handles empty input', () => {
        const re = /^$/;
        expect(testRegexWithBoundedInput(re, '')).toBe(true);
    });

    it('resets lastIndex before each test (global flag safety)', () => {
        const re = /\d+/g;
        re.lastIndex = 999; // simulate stale state
        expect(testRegexWithBoundedInput(re, '123')).toBe(true);
    });
});

describe('Integration: safe-regex with security patterns', () => {
    it('allows common PII detection patterns', () => {
        // Email regex — should be safe
        const emailRe = compileSafeRegex('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
        expect(emailRe).toBeInstanceOf(RegExp);
        expect(emailRe?.test('user@example.com')).toBe(true);
    });

    it('allows IP address detection pattern', () => {
        const ipRe = compileSafeRegex('\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b');
        expect(ipRe).toBeInstanceOf(RegExp);
        expect(ipRe?.test('192.168.1.1')).toBe(true);
    });

    it('blocks classic ReDoS payload pattern', () => {
        // (.*)+$ — catastrophic backtracking
        const re = compileSafeRegex('(.*)+$');
        expect(re).toBeNull();
    });

    it('allows allowlist channel filter pattern', () => {
        const re = compileSafeRegex('^channel:(discord|telegram|slack)$');
        expect(re).toBeInstanceOf(RegExp);
        expect(re?.test('channel:discord')).toBe(true);
        expect(re?.test('channel:unknown')).toBe(false);
    });
});
