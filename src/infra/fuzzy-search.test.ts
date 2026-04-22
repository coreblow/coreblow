import { describe, it, expect, beforeEach } from 'vitest';
import { FuzzySearch } from './fuzzy-search.js';

describe('FuzzySearch', () => {
    let search: FuzzySearch;

    beforeEach(() => {
        search = new FuzzySearch();
        search.addMany([
            { id: '1', value: 'javascript' },
            { id: '2', value: 'typescript' },
            { id: '3', value: 'python' },
            { id: '4', value: 'rust' },
            { id: '5', value: 'golang' },
        ]);
    });

    describe('exact contains', () => {
        it('finds exact substring match with score 1', () => {
            const results = search.search('script');
            expect(results.length).toBeGreaterThanOrEqual(2);
            expect(results[0]?.score).toBe(1);
        });

        it('is case-insensitive', () => {
            const results = search.search('PYTHON');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]?.value).toBe('python');
        });
    });

    describe('fuzzy match', () => {
        it('matches with small edit distance', () => {
            const results = search.search('typscript'); // missing 'e'
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.value === 'typescript')).toBe(true);
        });

        it('respects max distance', () => {
            search.setMaxDistance(0);
            const results = search.search('typscript');
            // With max distance 0, only exact contains should match
            expect(results.every(r => r.distance === 0)).toBe(true);
        });
    });

    describe('scoring', () => {
        it('sorts by score descending', () => {
            const results = search.search('type');
            for (let i = 1; i < results.length; i++) {
                expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
            }
        });
    });

    describe('bestMatch', () => {
        it('returns best match', () => {
            const best = search.bestMatch('rust');
            expect(best).not.toBeNull();
            expect(best!.value).toBe('rust');
        });

        it('returns null for no match', () => {
            search.setMaxDistance(0);
            expect(search.bestMatch('zzzzz')).toBeNull();
        });
    });

    describe('limit', () => {
        it('respects result limit', () => {
            const results = search.search('t', 2);
            expect(results.length).toBeLessThanOrEqual(2);
        });
    });

    describe('add + count', () => {
        it('counts entries', () => {
            expect(search.count()).toBe(5);
        });

        it('adds individual entries', () => {
            search.add('6', 'ruby');
            expect(search.count()).toBe(6);
        });
    });
});
