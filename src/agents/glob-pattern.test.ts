/**
 * CoreBlow — Glob Pattern Tests
 *
 * Tests for compileGlobPattern, compileGlobPatterns, matchesAnyGlobPattern.
 */

import { describe, it, expect } from 'vitest';
import {
    compileGlobPattern,
    compileGlobPatterns,
    matchesAnyGlobPattern,
} from './glob-pattern.js';

const id = (v: string) => v;

describe('compileGlobPattern', () => {
    it('compiles "*" to kind:all', () => {
        const p = compileGlobPattern({ raw: '*', normalize: id });
        expect(p.kind).toBe('all');
    });

    it('compiles exact string', () => {
        const p = compileGlobPattern({ raw: 'foo', normalize: id });
        expect(p.kind).toBe('exact');
        if (p.kind === 'exact') expect(p.value).toBe('foo');
    });

    it('compiles wildcard pattern to regex', () => {
        const p = compileGlobPattern({ raw: 'foo*', normalize: id });
        expect(p.kind).toBe('regex');
    });

    it('compiles prefix+suffix wildcard', () => {
        const p = compileGlobPattern({ raw: '*foo*', normalize: id });
        expect(p.kind).toBe('regex');
        if (p.kind === 'regex') {
            expect(p.value.test('xfoox')).toBe(true);
            expect(p.value.test('bar')).toBe(false);
        }
    });

    it('applies normalize function', () => {
        const p = compileGlobPattern({ raw: 'FOO', normalize: (v) => v.toLowerCase() });
        if (p.kind === 'exact') expect(p.value).toBe('foo');
    });

    it('empty normalized string = exact empty', () => {
        const p = compileGlobPattern({ raw: '  ', normalize: (v) => v.trim() });
        expect(p.kind).toBe('exact');
    });
});

describe('compileGlobPatterns', () => {
    it('returns empty for undefined', () => {
        expect(compileGlobPatterns({ normalize: id })).toHaveLength(0);
    });

    it('compiles array of patterns', () => {
        const patterns = compileGlobPatterns({ raw: ['*', 'foo', 'bar*'], normalize: id });
        expect(patterns).toHaveLength(3);
    });

    it('filters out empty exact patterns', () => {
        const patterns = compileGlobPatterns({ raw: ['', 'foo'], normalize: id });
        expect(patterns).toHaveLength(1);
    });
});

describe('matchesAnyGlobPattern', () => {
    it('matches "all" pattern against anything', () => {
        const p = compileGlobPattern({ raw: '*', normalize: id });
        expect(matchesAnyGlobPattern('anything', [p])).toBe(true);
    });

    it('matches exact pattern', () => {
        const p = compileGlobPattern({ raw: 'foo', normalize: id });
        expect(matchesAnyGlobPattern('foo', [p])).toBe(true);
        expect(matchesAnyGlobPattern('bar', [p])).toBe(false);
    });

    it('matches regex pattern', () => {
        const p = compileGlobPattern({ raw: 'foo*', normalize: id });
        expect(matchesAnyGlobPattern('foobar', [p])).toBe(true);
        expect(matchesAnyGlobPattern('bazfoo', [p])).toBe(false);
    });

    it('returns false for empty patterns', () => {
        expect(matchesAnyGlobPattern('foo', [])).toBe(false);
    });

    it('matches first of multiple patterns', () => {
        const patterns = compileGlobPatterns({ raw: ['abc', 'xyz*'], normalize: id });
        expect(matchesAnyGlobPattern('xyz123', patterns)).toBe(true);
        expect(matchesAnyGlobPattern('abc', patterns)).toBe(true);
        expect(matchesAnyGlobPattern('none', patterns)).toBe(false);
    });
});
