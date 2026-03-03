import { describe, it, expect, vi } from 'vitest';
import { safeJsonParse } from './json-utils.js';
import { parseQS } from './url-utils.js';
import { deepClone } from './deep-clone.js';
import { capitalize, camelToKebab, kebabToCamel } from './string-utils2.js';
import { tokensPerSecond, costPerToken } from './rate-utils.js';
import { debounce, throttle } from './debounce.js';

// ═══════════════════════════════════════════════════════════════════
// safeJsonParse
// ═══════════════════════════════════════════════════════════════════

describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
        expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it('returns fallback on invalid JSON', () => {
        expect(safeJsonParse('not json', 'default')).toBe('default');
    });

    it('parses arrays', () => {
        expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    });

    it('parses numbers', () => {
        expect(safeJsonParse('42', 0)).toBe(42);
    });

    it('parses null', () => {
        expect(safeJsonParse('null', 'default')).toBeNull();
    });

    it('returns fallback on empty string', () => {
        expect(safeJsonParse('', 'default')).toBe('default');
    });

    it('handles nested objects', () => {
        expect(safeJsonParse('{"a":{"b":1}}', {})).toEqual({ a: { b: 1 } });
    });
});

// ═══════════════════════════════════════════════════════════════════
// parseQS
// ═══════════════════════════════════════════════════════════════════

describe('parseQS', () => {
    it('parses query string', () => {
        expect(parseQS('a=1&b=2')).toEqual({ a: '1', b: '2' });
    });

    it('strips leading ?', () => {
        expect(parseQS('?a=1&b=2')).toEqual({ a: '1', b: '2' });
    });

    it('handles empty values', () => {
        expect(parseQS('key=')).toEqual({ key: '' });
    });

    it('handles missing values', () => {
        expect(parseQS('key')).toEqual({ key: '' });
    });

    it('decodes URI components', () => {
        expect(parseQS('name=hello%20world')).toEqual({ name: 'hello world' });
    });

    it('handles empty string', () => {
        const result = parseQS('');
        // empty string produces single empty pair
        expect(typeof result).toBe('object');
    });

    it('handles multiple & separated params', () => {
        expect(parseQS('a=1&b=2&c=3')).toEqual({ a: '1', b: '2', c: '3' });
    });
});

// ═══════════════════════════════════════════════════════════════════
// deepClone
// ═══════════════════════════════════════════════════════════════════

describe('deepClone', () => {
    it('clones primitive', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(null)).toBeNull();
    });

    it('clones array', () => {
        const arr = [1, 2, 3];
        const cloned = deepClone(arr);
        expect(cloned).toEqual([1, 2, 3]);
        cloned.push(4);
        expect(arr).toHaveLength(3);
    });

    it('clones nested object', () => {
        const obj = { a: { b: { c: 1 } } };
        const cloned = deepClone(obj);
        cloned.a.b.c = 99;
        expect(obj.a.b.c).toBe(1);
    });

    it('clones mixed nested', () => {
        const obj = { arr: [1, { x: 2 }], str: 'hi' };
        const cloned = deepClone(obj);
        expect(cloned).toEqual(obj);
        (cloned.arr[1] as any).x = 99;
        expect((obj.arr[1] as any).x).toBe(2);
    });

    it('handles empty objects/arrays', () => {
        expect(deepClone({})).toEqual({});
        expect(deepClone([])).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════
// String Utils
// ═══════════════════════════════════════════════════════════════════

describe('capitalize', () => {
    it('capitalizes first letter', () => { expect(capitalize('hello')).toBe('Hello'); });
    it('handles empty string', () => { expect(capitalize('')).toBe(''); });
    it('handles single char', () => { expect(capitalize('a')).toBe('A'); });
    it('preserves rest of string', () => { expect(capitalize('hELLO')).toBe('HELLO'); });
});

describe('camelToKebab', () => {
    it('converts camelCase', () => { expect(camelToKebab('myVariable')).toBe('my-variable'); });
    it('handles multi-word', () => { expect(camelToKebab('myLongVariableName')).toBe('my-long-variable-name'); });
    it('handles no capitals', () => { expect(camelToKebab('hello')).toBe('hello'); });
});

describe('kebabToCamel', () => {
    it('converts kebab-case', () => { expect(kebabToCamel('my-variable')).toBe('myVariable'); });
    it('handles multi-word', () => { expect(kebabToCamel('my-long-name')).toBe('myLongName'); });
    it('handles no hyphens', () => { expect(kebabToCamel('hello')).toBe('hello'); });
});

// ═══════════════════════════════════════════════════════════════════
// Rate Utils
// ═══════════════════════════════════════════════════════════════════

describe('tokensPerSecond', () => {
    it('calculates tps', () => { expect(tokensPerSecond(100, 2000)).toBe(50); });
    it('returns 0 for zero duration', () => { expect(tokensPerSecond(100, 0)).toBe(0); });
    it('rounds result', () => { expect(tokensPerSecond(10, 3000)).toBe(3); }); // 3.33 → 3
});

describe('costPerToken', () => {
    it('calculates cost', () => { expect(costPerToken(1.0, 1000)).toBeCloseTo(0.001); });
    it('returns 0 for zero tokens', () => { expect(costPerToken(1.0, 0)).toBe(0); });
});

// ═══════════════════════════════════════════════════════════════════
// Debounce & Throttle
// ═══════════════════════════════════════════════════════════════════

describe('debounce', () => {
    it('delays execution', async () => {
        const fn = vi.fn();
        const deb = debounce(fn, 50);
        deb();
        deb();
        deb();
        expect(fn).not.toHaveBeenCalled();
        await new Promise(r => setTimeout(r, 100));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on each call', async () => {
        const fn = vi.fn();
        const deb = debounce(fn, 50);
        deb();
        await new Promise(r => setTimeout(r, 30));
        deb(); // reset
        await new Promise(r => setTimeout(r, 30));
        expect(fn).not.toHaveBeenCalled();
        await new Promise(r => setTimeout(r, 50));
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('throttle', () => {
    it('executes immediately first time', () => {
        const fn = vi.fn();
        const thr = throttle(fn, 100);
        thr();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throttles subsequent calls', () => {
        const fn = vi.fn();
        const thr = throttle(fn, 100);
        thr(); // executes
        thr(); // skipped
        thr(); // skipped
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('allows after interval passes', async () => {
        const fn = vi.fn();
        const thr = throttle(fn, 50);
        thr();
        await new Promise(r => setTimeout(r, 60));
        thr();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
