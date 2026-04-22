/**
 * CoreBlow — BM25 Index Tests
 *
 * Tests for BM25 text search: document indexing, scoring,
 * search ranking, tokenization, IDF, statistics, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BM25Index, tokenize } from './bm25.js';

describe('BM25Index', () => {
    let index: BM25Index;

    beforeEach(() => {
        index = new BM25Index();
    });

    // === Tokenizer ===

    describe('tokenize', () => {
        it('lowercases and splits on non-word chars', () => {
            const tokens = tokenize('Hello World!');
            expect(tokens).toEqual(['hello', 'world']);
        });

        it('removes stop words', () => {
            const tokens = tokenize('The cat is on the mat');
            expect(tokens).not.toContain('the');
            expect(tokens).not.toContain('is');
            expect(tokens).not.toContain('on');
            expect(tokens).toContain('cat');
            expect(tokens).toContain('mat');
        });

        it('removes single-char tokens', () => {
            const tokens = tokenize('I x y love');
            expect(tokens).not.toContain('x');
            expect(tokens).not.toContain('y');
        });

        it('handles empty string', () => {
            expect(tokenize('')).toEqual([]);
        });

        it('removes Indonesian stop words', () => {
            const tokens = tokenize('saya dan dia');
            expect(tokens).toEqual([]);
        });
    });

    // === Document Indexing ===

    describe('addDocument', () => {
        it('adds a document and updates stats', () => {
            index.addDocument('d1', 'typescript programming language');
            const stats = index.stats();
            expect(stats.documents).toBe(1);
            expect(stats.terms).toBeGreaterThan(0);
        });

        it('overwrites document with same id', () => {
            index.addDocument('d1', 'first version');
            index.addDocument('d1', 'second version');
            expect(index.stats().documents).toBe(1);
        });
    });

    describe('addDocuments', () => {
        it('bulk adds documents', () => {
            index.addDocuments([
                { id: 'd1', text: 'hello world' },
                { id: 'd2', text: 'what great day' },
            ]);
            expect(index.stats().documents).toBe(2);
        });
    });

    describe('removeDocument', () => {
        it('removes a document', () => {
            index.addDocument('d1', 'test doc');
            expect(index.removeDocument('d1')).toBe(true);
            expect(index.stats().documents).toBe(0);
        });

        it('returns false for non-existent document', () => {
            expect(index.removeDocument('ghost')).toBe(false);
        });
    });

    // === Search ===

    describe('search', () => {
        beforeEach(() => {
            index.addDocuments([
                { id: 'ts', text: 'TypeScript is a strongly typed programming language' },
                { id: 'js', text: 'JavaScript runs in the browser and Node.js' },
                { id: 'py', text: 'Python is great for machine learning and data science' },
                { id: 'rs', text: 'Rust programming provides memory safety without garbage collection' },
            ]);
        });

        it('returns relevant documents ranked by score', () => {
            const results = index.search('programming language');
            expect(results.length).toBeGreaterThan(0);
            // TypeScript and Rust both mention "programming"
            const ids = results.map(r => r.id);
            expect(ids).toContain('ts');
        });

        it('returns empty for no matching terms', () => {
            const results = index.search('quantum physics');
            expect(results).toEqual([]);
        });

        it('respects topK limit', () => {
            const results = index.search('programming', 1);
            expect(results).toHaveLength(1);
        });

        it('scores documents with more matching terms higher', () => {
            const results = index.search('typed programming language');
            if (results.length >= 2) {
                // TypeScript has "typed", "programming", "language"
                expect(results[0]!.id).toBe('ts');
            }
        });

        it('returns empty for empty query', () => {
            expect(index.search('')).toEqual([]);
        });

        it('returns empty for stop-words-only query', () => {
            expect(index.search('the is a')).toEqual([]);
        });
    });

    // === scoreDocument ===

    describe('scoreDocument', () => {
        it('returns 0 for non-existent document', () => {
            expect(index.scoreDocument('ghost', 'test')).toBe(0);
        });

        it('returns positive score for matching document', () => {
            index.addDocument('d1', 'TypeScript programming');
            expect(index.scoreDocument('d1', 'programming')).toBeGreaterThan(0);
        });

        it('returns 0 for non-matching query', () => {
            index.addDocument('d1', 'TypeScript programming');
            expect(index.scoreDocument('d1', 'quantum physics')).toBe(0);
        });
    });

    // === IDF & DF ===

    describe('idf / df', () => {
        it('computes document frequency', () => {
            index.addDocument('d1', 'cat dog');
            index.addDocument('d2', 'cat bird');
            expect(index.df('cat')).toBe(2);
            expect(index.df('dog')).toBe(1);
            expect(index.df('fish')).toBe(0);
        });

        it('IDF is higher for rarer terms', () => {
            index.addDocument('d1', 'cat dog');
            index.addDocument('d2', 'cat bird');
            expect(index.idf('dog')).toBeGreaterThan(index.idf('cat'));
        });
    });

    // === Clear ===

    describe('clear', () => {
        it('resets the entire index', () => {
            index.addDocuments([
                { id: 'd1', text: 'hello' },
                { id: 'd2', text: 'world' },
            ]);
            index.clear();
            expect(index.stats().documents).toBe(0);
            expect(index.stats().terms).toBe(0);
        });
    });
});
