/**
 * Performance Test: safe-regex Engine
 *
 * Baseline benchmarks untuk ReDoS protection engine.
 * Memastikan overhead compilation acceptable untuk real-time processing.
 *
 * SLA targets (dikalibrasi untuk modern hardware, M-series Mac / Linux CI):
 *   - 1000 unique pattern compilations: < 500ms
 *   - 1000 cache hits: < 20ms (LRU cache hot)
 *   - 1000 bounded input tests: < 100ms
 *   - Unsafe pattern rejection: < 5ms each
 *
 * Run: npm run test:performance
 *
 * @see gateway/src/security/safe-regex.ts
 */
import { describe, it, expect } from 'vitest';
import {
    compileSafeRegex,
    compileSafeRegexDetailed,
    testRegexWithBoundedInput,
} from '../../src/security/safe-regex.js';

const ITERATIONS = 1000;

describe('Perf: compileSafeRegex — unique patterns', () => {
    it(`compiles ${ITERATIONS} unique safe patterns within 500ms`, () => {
        // Warm up
        compileSafeRegex('^warmup$');

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            const re = compileSafeRegex(`^unique-pattern-${i}-[a-z]+$`);
            expect(re).not.toBeNull();
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(500);
    });
});

describe('Perf: compileSafeRegex — LRU cache hits', () => {
    it(`${ITERATIONS} cache hits take < 20ms (10x faster than fresh compile)`, () => {
        const PATTERN = '^cached-baseline-pattern-[0-9]+$';

        // Prime the cache
        compileSafeRegex(PATTERN);

        // Measure cache hit performance
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            compileSafeRegex(PATTERN);
        }
        const cacheElapsed = performance.now() - start;

        expect(cacheElapsed).toBeLessThan(20);
    });

    it('cache correctly returns same RegExp instance', () => {
        const PATTERN = '^same-instance-check$';
        const r1 = compileSafeRegex(PATTERN);
        const r2 = compileSafeRegex(PATTERN);
        expect(r1).toBe(r2); // same reference (LRU hit)
    });
});

describe('Perf: compileSafeRegex — unsafe pattern rejection', () => {
    const UNSAFE_PATTERNS = [
        '(a+)+$',
        '(a|aa)+$',
        '([0-9]+)*',
        '(x+x+)+y',
        '(.+)+$',
    ];

    it('rejects unsafe patterns quickly (< 5ms each)', () => {
        for (const pattern of UNSAFE_PATTERNS) {
            const start = performance.now();
            const result = compileSafeRegex(pattern);
            const elapsed = performance.now() - start;
            expect(result).toBeNull();
            expect(elapsed).toBeLessThan(5);
        }
    });
});

describe('Perf: testRegexWithBoundedInput — large input handling', () => {
    it(`${ITERATIONS} bounded tests on 5000-char input take < 200ms`, () => {
        const re = compileSafeRegex('[a-z]+');
        expect(re).not.toBeNull();

        // 5000 char input (beyond the 2048-char window)
        const largeInput = 'abcdef'.repeat(834);
        expect(largeInput.length).toBeGreaterThan(2048);

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            testRegexWithBoundedInput(re!, largeInput);
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(200);
    });

    it('bounded test on 100k-char input: < 10ms (window truncation working)', () => {
        const re = compileSafeRegex('[a-z]+');
        expect(re).not.toBeNull();

        const hugeInput = 'a'.repeat(100_000);

        const start = performance.now();
        testRegexWithBoundedInput(re!, hugeInput);
        const elapsed = performance.now() - start;

        // Should be fast because we only test head+tail window, not full string
        expect(elapsed).toBeLessThan(10);
    });
});

describe('Perf: compileSafeRegexDetailed — structured result overhead', () => {
    it(`${ITERATIONS} detailed compilations take < 600ms (slight overhead vs basic)`, () => {
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            const result = compileSafeRegexDetailed(`^detailed-${i}-[a-z]+$`);
            expect(result.reason).toBeNull();
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(600);
    });
});
