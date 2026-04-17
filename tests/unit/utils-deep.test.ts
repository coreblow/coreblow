/**
 * Tests: Utils — string, array, date, json, url, debounce, clone
 */
import { describe, it, expect, vi } from 'vitest';
import { capitalize, camelToKebab, kebabToCamel } from '../../src/utils/string-utils2.js';
import { chunk, unique, shuffle } from '../../src/utils/array-utils.js';
import { daysAgo, isToday, formatRelative } from '../../src/utils/date-utils.js';
import { safeJsonParse } from '../../src/utils/json-utils.js';
import { isUrl } from '../../src/utils/url-parse.js';
import { debounce, throttle } from '../../src/utils/debounce.js';
import { deepClone } from '../../src/utils/deep-clone.js';

// ═══════════════════════════════════════════════════════════════
// STRING UTILS
// ═══════════════════════════════════════════════════════════════

describe('String Utils', () => {
    it('capitalize', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('')).toBe('');
    });

    it('camelToKebab', () => {
        expect(camelToKebab('myVarName')).toBe('my-var-name');
    });

    it('kebabToCamel', () => {
        expect(kebabToCamel('my-var-name')).toBe('myVarName');
    });
});

// ═══════════════════════════════════════════════════════════════
// ARRAY UTILS
// ═══════════════════════════════════════════════════════════════

describe('Array Utils', () => {
    it('chunk splits array', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('chunk handles empty', () => {
        expect(chunk([], 3)).toEqual([]);
    });

    it('unique removes duplicates', () => {
        expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3]);
    });

    it('shuffle preserves all elements', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = shuffle(arr);
        expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('shuffle does not mutate original', () => {
        const arr = [1, 2, 3];
        shuffle(arr);
        expect(arr).toEqual([1, 2, 3]);
    });
});

// ═══════════════════════════════════════════════════════════════
// DATE UTILS
// ═══════════════════════════════════════════════════════════════

describe('Date Utils', () => {
    it('daysAgo returns past date', () => {
        const d = daysAgo(7);
        expect(d.getTime()).toBeLessThan(Date.now());
    });

    it('isToday returns true for today', () => {
        expect(isToday(new Date())).toBe(true);
    });

    it('isToday returns false for yesterday', () => {
        expect(isToday(daysAgo(1))).toBe(false);
    });

    it('formatRelative returns "just now" for recent date', () => {
        expect(formatRelative(new Date())).toBe('just now');
    });

    it('formatRelative shows minutes', () => {
        const d = new Date(Date.now() - 5 * 60_000);
        expect(formatRelative(d)).toContain('m ago');
    });

    it('formatRelative shows hours', () => {
        const d = new Date(Date.now() - 3 * 3600_000);
        expect(formatRelative(d)).toContain('h ago');
    });

    it('formatRelative shows days', () => {
        const d = new Date(Date.now() - 5 * 86400_000);
        expect(formatRelative(d)).toContain('d ago');
    });
});

// ═══════════════════════════════════════════════════════════════
// JSON UTILS
// ═══════════════════════════════════════════════════════════════

describe('JSON Utils', () => {
    it('safeJsonParse parses valid JSON', () => {
        expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it('safeJsonParse returns fallback for invalid', () => {
        expect(safeJsonParse('not json', { fallback: true })).toEqual({ fallback: true });
    });
});

// ═══════════════════════════════════════════════════════════════
// URL PARSE
// ═══════════════════════════════════════════════════════════════

describe('URL Parse', () => {
    it('isUrl — valid URLs', () => {
        expect(isUrl('https://example.com')).toBe(true);
        expect(isUrl('http://localhost:3000')).toBe(true);
    });

    it('isUrl — invalid', () => {
        expect(isUrl('not a url')).toBe(false);
        expect(isUrl('')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// DEBOUNCE / THROTTLE
// ═══════════════════════════════════════════════════════════════

describe('Debounce', () => {
    it('debounces calls', async () => {
        let count = 0;
        const fn = debounce(() => count++, 50);
        fn(); fn(); fn();
        await new Promise(r => setTimeout(r, 100));
        expect(count).toBe(1);
    });

    it('throttles calls', () => {
        let count = 0;
        const fn = throttle(() => count++, 50);
        fn(); fn(); fn();
        expect(count).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════
// DEEP CLONE
// ═══════════════════════════════════════════════════════════════

describe('deepClone', () => {
    it('clones simple object', () => {
        const obj = { a: 1, b: 'hello' };
        const clone = deepClone(obj);
        expect(clone).toEqual(obj);
        expect(clone).not.toBe(obj);
    });

    it('clones nested objects', () => {
        const obj = { a: { b: { c: 3 } } };
        const clone = deepClone(obj);
        expect(clone.a.b.c).toBe(3);
        clone.a.b.c = 99;
        expect(obj.a.b.c).toBe(3);
    });

    it('clones arrays', () => {
        const arr = [1, [2, 3], { a: 4 }];
        const clone = deepClone(arr);
        expect(clone).toEqual(arr);
        expect(clone).not.toBe(arr);
    });

    it('handles primitives', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(null)).toBeNull();
    });
});
