/**
 * CoreBlow Phase 38 — Search & Indexing Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from '../../src/infra/search-engine.js';
import { InvertedIndex } from '../../src/infra/inverted-index.js';
import { FuzzySearch } from '../../src/infra/fuzzy-search.js';
import { SearchRanking } from '../../src/infra/search-ranking.js';
import { QueryParser } from '../../src/infra/query-parser.js';

// ================================================================
describe('SearchEngine', () => {
    let engine: SearchEngine;
    beforeEach(() => {
        engine = new SearchEngine();
        engine.index('1', { title: 'Getting Started with CoreBlow', body: 'Learn how to setup' });
        engine.index('2', { title: 'API Reference', body: 'Complete API documentation for CoreBlow' });
        engine.index('3', { title: 'Deployment Guide', body: 'Deploy to production' });
    });

    it('should find by term', () => {
        const result = engine.search('CoreBlow');
        expect(result.total).toBe(2);
    });

    it('should rank by score', () => {
        engine.setWeights({ title: 2, body: 1 });
        const result = engine.search('CoreBlow');
        expect(result.hits[0]!.score).toBeGreaterThan(0);
    });

    it('should highlight matches', () => {
        const result = engine.search('API');
        expect(result.hits[0]?.highlights.title).toContain('<em>');
    });

    it('should paginate', () => {
        const result = engine.search('CoreBlow', 1, 1);
        expect(result.hits).toHaveLength(1);
        expect(result.total).toBe(2);
    });

    it('should remove documents', () => {
        engine.remove('1');
        expect(engine.count()).toBe(2);
    });
});

// ================================================================
describe('InvertedIndex', () => {
    let idx: InvertedIndex;
    beforeEach(() => {
        idx = new InvertedIndex();
        idx.add('doc1', 'title', 'CoreBlow AI Gateway');
        idx.add('doc2', 'title', 'Machine Learning Models');
        idx.add('doc3', 'title', 'CoreBlow API Reference');
    });

    it('should search terms', () => {
        const results = idx.search('coreblow');
        expect(results).toHaveLength(2);
    });

    it('should filter stopwords', () => {
        const results = idx.search('the');
        expect(results).toHaveLength(0);
    });

    it('should search all (AND)', () => {
        const docs = idx.searchAll(['coreblow', 'api']);
        expect(docs).toContain('doc3');
        expect(docs).not.toContain('doc1');
    });

    it('should calculate IDF', () => {
        const idf = idx.idf('coreblow');
        expect(idf).toBeGreaterThan(0);
    });

    it('should count terms', () => {
        expect(idx.termCount()).toBeGreaterThan(0);
    });
});

// ================================================================
describe('FuzzySearch', () => {
    let fuzzy: FuzzySearch;
    beforeEach(() => {
        fuzzy = new FuzzySearch();
        fuzzy.addMany([
            { id: '1', value: 'typescript' },
            { id: '2', value: 'javascript' },
            { id: '3', value: 'python' },
            { id: '4', value: 'golang' },
        ]);
    });

    it('should find exact matches', () => {
        const results = fuzzy.search('typescript');
        expect(results[0]?.id).toBe('1');
    });

    it('should find fuzzy matches', () => {
        const results = fuzzy.search('typscript'); // missing 'e'
        expect(results.some((r) => r.id === '1')).toBe(true);
    });

    it('should find substring matches', () => {
        const results = fuzzy.search('script');
        expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should get best match', () => {
        const best = fuzzy.bestMatch('pythn');
        expect(best?.id).toBe('3');
    });

    it('should limit results', () => {
        const results = fuzzy.search('a', 2);
        expect(results.length).toBeLessThanOrEqual(2);
    });
});

// ================================================================
describe('SearchRanking', () => {
    let ranking: SearchRanking;
    beforeEach(() => { ranking = new SearchRanking(); });

    it('should rank by TF-IDF', () => {
        const results = ranking.rank([
            { id: '1', termFrequency: 5, docFrequency: 2, totalDocs: 100 },
            { id: '2', termFrequency: 1, docFrequency: 50, totalDocs: 100 },
        ]);
        expect(results[0]!.id).toBe('1');
    });

    it('should include freshness', () => {
        const results = ranking.rank([
            { id: '1', termFrequency: 1, docFrequency: 10, totalDocs: 100, freshness: 1 },
            { id: '2', termFrequency: 1, docFrequency: 10, totalDocs: 100, freshness: 0 },
        ]);
        expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    });

    it('should apply custom boosts', () => {
        ranking.addBoost('premium', 2);
        const results = ranking.rank([
            { id: '1', termFrequency: 1, docFrequency: 10, totalDocs: 100, boosts: { premium: 1 } },
            { id: '2', termFrequency: 1, docFrequency: 10, totalDocs: 100 },
        ]);
        expect(results[0]!.id).toBe('1');
    });

    it('should show score components', () => {
        const results = ranking.rank([
            { id: '1', termFrequency: 3, docFrequency: 5, totalDocs: 100, freshness: 0.8 },
        ]);
        expect(results[0]!.components.tfidf).toBeGreaterThan(0);
    });
});

// ================================================================
describe('QueryParser', () => {
    const parser = new QueryParser();

    it('should parse terms', () => {
        const q = parser.parse('hello world');
        expect(q.terms).toEqual(['hello', 'world']);
    });

    it('should parse phrases', () => {
        const q = parser.parse('"exact match" test');
        expect(q.phrases).toEqual(['exact match']);
    });

    it('should parse field filters', () => {
        const q = parser.parse('type:agent status:active');
        expect(q.filters).toHaveLength(2);
        expect(q.filters[0]?.field).toBe('type');
    });

    it('should parse negations', () => {
        const q = parser.parse('hello -world');
        expect(q.negations).toContain('world');
    });

    it('should parse operators', () => {
        const q = parser.parse('hello AND world');
        expect(q.tokens.some((t) => t.type === 'operator')).toBe(true);
    });

    it('should stringify back', () => {
        const q = parser.parse('hello "world test" type:agent -bad');
        const str = parser.stringify(q);
        expect(str).toContain('hello');
        expect(str).toContain('"world test"');
    });
});
