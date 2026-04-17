/**
 * Contract Test: Safe Regex Engine
 *
 * Verifikasi behavioral contract dari safe-regex public API.
 *
 * Contracts:
 * 1. compileSafeRegex() selalu return RegExp | null (tidak pernah throw)
 * 2. compileSafeRegexDetailed().reason selalu salah satu dari 3 nilai
 * 3. compileSafeRegexDetailed() selalu return { regex, source, flags, reason }
 * 4. Jika reason === null → regex dijamin non-null (dan sebaliknya)
 * 5. testRegexWithBoundedInput() selalu return boolean (tidak pernah throw)
 * 6. hasNestedRepetition() selalu return boolean (tidak pernah throw)
 * 7. Cache: memanggil dua kali dengan pattern yang sama return hasil identik
 */
import { describe, it, expect } from 'vitest';
import {
    compileSafeRegex,
    compileSafeRegexDetailed,
    hasNestedRepetition,
    testRegexWithBoundedInput,
} from '../../src/security/safe-regex.js';

const VALID_REJECT_REASONS = ['empty', 'unsafe-nested-repetition', 'invalid-regex', null] as const;

describe('compileSafeRegex — contract', () => {
    const patterns = [
        '^abc$',
        '(a+)+$',       // unsafe
        '   ',          // empty
        '(invalid',     // invalid
        '[a-z]+',
        '.*',
        '(a|aa)+$',     // unsafe ambiguous
    ];

    it.each(patterns)('never throws for pattern: %s', (pattern) => {
        expect(() => compileSafeRegex(pattern)).not.toThrow();
    });

    it.each(patterns)('always returns RegExp | null for: %s', (pattern) => {
        const result = compileSafeRegex(pattern);
        expect(result === null || result instanceof RegExp).toBe(true);
    });
});

describe('compileSafeRegexDetailed — shape contract', () => {
    const patterns = ['^abc$', '(a+)+$', '   ', '(invalid', '[0-9]+'];

    it.each(patterns)('always returns required shape for: %s', (pattern) => {
        const result = compileSafeRegexDetailed(pattern);

        // Shape contract
        expect('regex' in result).toBe(true);
        expect('source' in result).toBe(true);
        expect('flags' in result).toBe(true);
        expect('reason' in result).toBe(true);

        // Type invariants
        expect(result.regex === null || result.regex instanceof RegExp).toBe(true);
        expect(typeof result.source).toBe('string');
        expect(typeof result.flags).toBe('string');
        expect(VALID_REJECT_REASONS).toContain(result.reason);
    });

    it('reason=null ↔ regex non-null (bidirectional)', () => {
        const safeResult = compileSafeRegexDetailed('^abc$');
        expect(safeResult.reason).toBeNull();
        expect(safeResult.regex).not.toBeNull();

        const unsafeResult = compileSafeRegexDetailed('(a+)+$');
        expect(unsafeResult.reason).not.toBeNull();
        expect(unsafeResult.regex).toBeNull();
    });

    it('is idempotent: same result for same input (cache)', () => {
        const pattern = '^idempotent-test-' + Math.random() + '$';
        const r1 = compileSafeRegexDetailed(pattern);
        const r2 = compileSafeRegexDetailed(pattern);
        expect(r1.reason).toBe(r2.reason);
        expect(r1.source).toBe(r2.source);
    });

    it('flags field matches requested flags', () => {
        const result = compileSafeRegexDetailed('^abc$', 'gi');
        expect(result.flags).toBe('gi');
    });
});

describe('hasNestedRepetition — contract', () => {
    it('always returns boolean (never throws)', () => {
        const inputs = ['', 'abc', '(a+)+$', '(?:foo)', undefined as unknown as string];
        for (const input of inputs) {
            expect(() => hasNestedRepetition(input ?? '')).not.toThrow();
            const result = hasNestedRepetition(input ?? '');
            expect(typeof result).toBe('boolean');
        }
    });
});

describe('testRegexWithBoundedInput — contract', () => {
    it('always returns boolean (never throws)', () => {
        const cases: Array<[RegExp, string]> = [
            [/abc/, 'abc'],
            [/abc/, ''],
            [/abc/g, 'x'.repeat(5000)],
            [/^$/, ''],
        ];

        for (const [re, input] of cases) {
            expect(() => testRegexWithBoundedInput(re, input)).not.toThrow();
            const result = testRegexWithBoundedInput(re, input);
            expect(typeof result).toBe('boolean');
        }
    });

    it('resets global regex lastIndex before each call', () => {
        const re = /\d+/g;
        re.lastIndex = 500; // stale state
        const result = testRegexWithBoundedInput(re, '123');
        expect(result).toBe(true);
    });
});
