import { describe, it, expect } from 'vitest';
import {
    expandWithSynonyms,
    decomposeQuery,
    extractKeyTerms,
    generateNgrams,
    expandQuery,
} from './query-expansion.js';

describe('expandWithSynonyms', () => {
    it('returns original query when no synonyms match', () => {
        const result = expandWithSynonyms('hello world');
        expect(result).toContain('hello world');
        expect(result).toHaveLength(1);
    });

    it('expands English synonyms', () => {
        const result = expandWithSynonyms('I like TypeScript');
        expect(result.length).toBeGreaterThan(1);
        expect(result.some(q => q.includes('enjoy'))).toBe(true);
    });

    it('expands Indonesian synonyms', () => {
        const result = expandWithSynonyms('saya suka makan');
        expect(result.length).toBeGreaterThan(1);
        expect(result.some(q => q.includes('menyukai'))).toBe(true);
    });

    it('does not duplicate the original query', () => {
        const result = expandWithSynonyms('fast api');
        const unique = new Set(result);
        expect(unique.size).toBe(result.length);
    });
});

describe('decomposeQuery', () => {
    it('splits on "and"', () => {
        const parts = decomposeQuery('TypeScript and JavaScript');
        expect(parts).toContain('TypeScript');
        expect(parts).toContain('JavaScript');
    });

    it('splits on commas', () => {
        const parts = decomposeQuery('react, vue, angular');
        expect(parts.length).toBe(3);
    });

    it('splits on Indonesian "dan"', () => {
        const parts = decomposeQuery('kucing dan anjing');
        expect(parts.length).toBe(2);
    });

    it('returns single-element array for simple queries', () => {
        const parts = decomposeQuery('hello world');
        expect(parts).toEqual(['hello world']);
    });

    it('extracts question subject', () => {
        const parts = decomposeQuery('What is machine learning');
        expect(parts.some(p => p.includes('machine learning'))).toBe(true);
    });
});

describe('extractKeyTerms', () => {
    it('removes English stop words', () => {
        const terms = extractKeyTerms('the quick brown fox is very fast');
        expect(terms).not.toContain('the');
        expect(terms).not.toContain('is');
        expect(terms).not.toContain('very');
        expect(terms).toContain('quick');
        expect(terms).toContain('brown');
    });

    it('removes Indonesian stop words', () => {
        const terms = extractKeyTerms('ini adalah contoh yang bagus');
        expect(terms).not.toContain('ini');
        expect(terms).not.toContain('adalah');
        expect(terms).not.toContain('yang');
        expect(terms).toContain('contoh');
        expect(terms).toContain('bagus');
    });

    it('removes single-character terms', () => {
        const terms = extractKeyTerms('a b c hello');
        expect(terms).toEqual(['hello']);
    });
});

describe('generateNgrams', () => {
    it('generates unigrams and bigrams by default', () => {
        const ngrams = generateNgrams(['hello', 'world', 'test']);
        expect(ngrams).toContain('hello');
        expect(ngrams).toContain('world');
        expect(ngrams).toContain('hello world');
        expect(ngrams).toContain('world test');
    });

    it('respects maxN parameter', () => {
        const ngrams = generateNgrams(['a', 'b', 'c'], 1);
        expect(ngrams).toEqual(['a', 'b', 'c']);
    });

    it('handles empty input', () => {
        expect(generateNgrams([])).toEqual([]);
    });
});

describe('expandQuery', () => {
    it('returns a structured result with all expansions', () => {
        const result = expandQuery('I like fast api');
        expect(result.original).toBe('I like fast api');
        expect(result.expanded.length).toBeGreaterThanOrEqual(1);
        expect(result.decomposed.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(result.keyTerms)).toBe(true);
        expect(Array.isArray(result.allQueries)).toBe(true);
    });

    it('deduplicates allQueries', () => {
        const result = expandQuery('hello world');
        const unique = new Set(result.allQueries);
        expect(unique.size).toBe(result.allQueries.length);
    });
});
