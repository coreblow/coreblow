// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { FuzzySearch } from './fuzzy-search.js';
import { SearchRanking } from './search-ranking.js';
import { SearchEngine } from './search-engine.js';

// ─── Fuzzy Search ──────────────────────────────────────────────

describe('Fuzzy Search — Phase 20', () => {
    let fuzzy: FuzzySearch;

    beforeEach(() => {
        fuzzy = new FuzzySearch();
        fuzzy.add('1', 'apple');
        fuzzy.add('2', 'banana');
        fuzzy.add('3', 'orange');
        fuzzy.add('4', 'pineapple');
    });

    it('exact substring match gets score 1', () => {
        const results = fuzzy.search('app');
        expect(results).toHaveLength(2); // apple, pineapple
        expect(results[0].score).toBe(1);
        expect(results[0].distance).toBe(0);
    });

    it('finds fuzzy match within distance', () => {
        const results = fuzzy.search('abple'); // 1 char off from apple
        expect(results).toHaveLength(1);
        expect(results[0].value).toBe('apple');
        expect(results[0].distance).toBe(1);
        expect(results[0].score).toBeLessThan(1);
    });

    it('filters out matches beyond max distance', () => {
        fuzzy.setMaxDistance(1);
        const results = fuzzy.search('banaox'); // Needs 2 edits
        expect(results).toHaveLength(0);
    });

    it('bestMatch returns top result', () => {
        const match = fuzzy.bestMatch('orng');
        expect(match).not.toBeNull();
        expect(match!.value).toBe('orange');
    });

    it('bestMatch returns null if no matches', () => {
        expect(fuzzy.bestMatch('xyz123')).toBeNull();
    });

    it('addMany adds multiple entries', () => {
        fuzzy.addMany([{ id: '5', value: 'grape' }, { id: '6', value: 'kiwi' }]);
        expect(fuzzy.count()).toBe(6);
        expect(fuzzy.search('kiw')).toHaveLength(1);
    });

    it('sorts by score descending', () => {
        fuzzy.add('5', 'bananx');
        const results = fuzzy.search('banana');
        expect(results[0].value).toBe('banana'); // exact contains -> score 1
        expect(results[1].value).toBe('bananx'); // 1 edit -> score < 1
        expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('respects limit parameter', () => {
        fuzzy.add('5', 'app1');
        fuzzy.add('6', 'app2');
        fuzzy.add('7', 'app3');
        const results = fuzzy.search('app', 2);
        expect(results).toHaveLength(2);
    });
});

// ─── Search Ranking ────────────────────────────────────────────

describe('Search Ranking — Phase 20', () => {
    let ranker: SearchRanking;

    beforeEach(() => {
        ranker = new SearchRanking();
    });

    it('ranks items based on internal weights', () => {
        const items = [
            { id: '1', termFrequency: 2, docFrequency: 5, totalDocs: 100, freshness: 1.0, popularity: 0.5 },
            { id: '2', termFrequency: 5, docFrequency: 5, totalDocs: 100, freshness: 0.1, popularity: 0.1 },
        ];
        const results = ranker.rank(items);
        expect(results).toHaveLength(2);
        // tf=5 vs tf=2 dominates TF-IDF
        expect(results[0].id).toBe('2'); 
        expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('applies setWeights', () => {
        ranker.setWeights({ freshness: 5.0, tfidf: 0.1 });
        const items = [
            { id: '1', termFrequency: 10, docFrequency: 1, totalDocs: 100, freshness: 0.1 },
            { id: '2', termFrequency: 1, docFrequency: 1, totalDocs: 100, freshness: 1.0 },
        ];
        const results = ranker.rank(items);
        expect(results[0].id).toBe('2'); // Freshness wins because of weight
        expect(ranker.getWeights().freshness).toBe(5.0);
    });

    it('applies custom boosts', () => {
        ranker.addBoost('is_sponsored', 10.0);
        const items = [
            { id: '1', termFrequency: 1, docFrequency: 1, totalDocs: 10, boosts: { is_sponsored: 1 } },
            { id: '2', termFrequency: 5, docFrequency: 1, totalDocs: 10 },
        ];
        const results = ranker.rank(items);
        expect(results[0].id).toBe('1'); // Boost wins
        expect(results[0].components['is_sponsored']).toBe(10);
    });

    it('handles zero docs safely', () => {
        const items = [{ id: '1', termFrequency: 5, docFrequency: 0, totalDocs: 0 }];
        const results = ranker.rank(items);
        expect(results[0].components.tfidf).toBe(0);
    });
});

// ─── Search Engine ─────────────────────────────────────────────

describe('Search Engine — Phase 20', () => {
    let engine: SearchEngine;

    beforeEach(() => {
        engine = new SearchEngine();
        engine.index('doc1', { title: 'Hello World', body: 'This is a test of the search engine' });
        engine.index('doc2', { title: 'Another Document', body: 'Hello again, world.' });
    });

    it('indexes documents', () => {
        expect(engine.count()).toBe(2);
        expect(engine.get('doc1')!.fields.title).toBe('Hello World');
    });

    it('searches single term', () => {
        const results = engine.search('hello');
        expect(results.total).toBe(2);
        expect(results.hits.map(h => h.id)).toContain('doc1');
        expect(results.hits.map(h => h.id)).toContain('doc2');
    });

    it('highlights matches with <em>', () => {
        const results = engine.search('test');
        expect(results.hits[0].highlights['body']).toContain('<em>test</em>');
    });

    it('weights fields for scoring', () => {
        engine.setWeights({ title: 10, body: 1 });
        const results = engine.search('world');
        // doc1 has 'world' in title. doc2 has 'world' in body. doc1 should win.
        expect(results.hits[0].id).toBe('doc1');
        expect(results.hits[0].score).toBeGreaterThan(results.hits[1].score);
    });

    it('handles multiple terms', () => {
        const results = engine.search('hello test');
        expect(results.hits[0].id).toBe('doc1'); // Has both
        expect(results.hits[0].score).toBeGreaterThan(0);
    });

    it('paginates results', () => {
        for (let i = 3; i <= 15; i++) {
            engine.index(`doc${i}`, { title: `Doc ${i}`, body: 'pagination test' });
        }
        const results = engine.search('pagination', 2, 5);
        expect(results.hits).toHaveLength(5);
        expect(results.page).toBe(2);
        expect(results.total).toBe(13); // 13 docs have 'pagination'
    });

    it('remove deletes document', () => {
        expect(engine.remove('doc1')).toBe(true);
        expect(engine.count()).toBe(1);
        expect(engine.search('test').total).toBe(0);
    });

    it('returns empty for no match', () => {
        const results = engine.search('unicorn');
        expect(results.total).toBe(0);
        expect(results.hits).toHaveLength(0);
    });
});
