/**
 * tests/unit/query-expansion.test.ts
 * Tests for query expansion system
 */
import { describe, it, expect } from 'vitest';
import {
    expandWithSynonyms,
    decomposeQuery,
    extractKeyTerms,
    generateNgrams,
    expandQuery,
} from '../../src/memory/query-expansion.js';

describe('expandWithSynonyms', () => {
    it('should return original query', () => {
        const results = expandWithSynonyms('hello world');
        expect(results).toContain('hello world');
    });

    it('should expand known synonyms', () => {
        const results = expandWithSynonyms('I like ai');
        expect(results.length).toBeGreaterThan(1);
        expect(results.some(r => r.includes('artificial intelligence'))).toBe(true);
    });

    it('should handle unknown words gracefully', () => {
        const results = expandWithSynonyms('xyzzyflorp');
        expect(results.length).toBe(1);
    });

    it('should expand tech abbreviations', () => {
        const results = expandWithSynonyms('ts and js');
        expect(results.some(r => r.includes('typescript'))).toBe(true);
        expect(results.some(r => r.includes('javascript'))).toBe(true);
    });

    it('should expand Indonesian words', () => {
        const results = expandWithSynonyms('saya suka makan');
        expect(results.length).toBeGreaterThan(1);
    });
});

describe('decomposeQuery', () => {
    it('should always include original query', () => {
        const results = decomposeQuery('simple query');
        expect(results).toContain('simple query');
    });

    it('should split on conjunctions', () => {
        const results = decomposeQuery('my favorite food and when I mentioned it');
        expect(results.length).toBeGreaterThan(1);
    });

    it('should extract question patterns', () => {
        const results = decomposeQuery('what is my favorite color');
        expect(results.length).toBeGreaterThan(1);
        expect(results.some(r => r.includes('favorite color'))).toBe(true);
    });

    it('should handle Indonesian conjunctions', () => {
        const results = decomposeQuery('makanan favorit dan kapan disebutkan');
        expect(results.length).toBeGreaterThan(1);
    });
});

describe('extractKeyTerms', () => {
    it('should remove English stop words', () => {
        const terms = extractKeyTerms('the quick brown fox is very fast');
        expect(terms).not.toContain('the');
        expect(terms).not.toContain('is');
        expect(terms).toContain('quick');
        expect(terms).toContain('brown');
    });

    it('should remove Indonesian stop words', () => {
        const terms = extractKeyTerms('saya yang ingin makan dengan dia');
        expect(terms).not.toContain('yang');
        expect(terms).not.toContain('dengan');
    });

    it('should handle empty input', () => {
        expect(extractKeyTerms('').length).toBe(0);
    });
});

describe('generateNgrams', () => {
    it('should generate unigrams and bigrams', () => {
        const ngrams = generateNgrams(['machine', 'learning', 'model']);
        expect(ngrams).toContain('machine');
        expect(ngrams).toContain('machine learning');
        expect(ngrams).toContain('learning model');
    });

    it('should generate trigrams', () => {
        const ngrams = generateNgrams(['machine', 'learning', 'model'], 3);
        expect(ngrams).toContain('machine learning model');
    });
});

describe('expandQuery (full pipeline)', () => {
    it('should return comprehensive expansion', () => {
        const result = expandQuery('What is my favorite ai tool');
        expect(result.original).toBe('What is my favorite ai tool');
        expect(result.expanded.length).toBeGreaterThan(1);
        expect(result.keyTerms.length).toBeGreaterThan(0);
        expect(result.allQueries.length).toBeGreaterThan(2);
    });

    it('should include synonyms in allQueries', () => {
        const result = expandQuery('I like fast js');
        expect(result.allQueries.some(q => q.includes('javascript'))).toBe(true);
    });

    it('should decompose compound queries', () => {
        const result = expandQuery('my name and my job');
        expect(result.decomposed.length).toBeGreaterThan(1);
    });
});
