// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { FormatConverter } from './format-converter.js';
import { InvertedIndex } from './inverted-index.js';
import { PubSub } from './pub-sub.js';

// ─── Format Converter ─────────────────────────────────────────

describe('Format Converter — Phase 18', () => {
    let conv: FormatConverter;
    beforeEach(() => { conv = new FormatConverter(); });

    it('jsonToCsv converts array', () => {
        const csv = conv.jsonToCsv([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
        expect(csv).toContain('name,age');
        expect(csv).toContain('Alice,30');
        expect(csv).toContain('Bob,25');
    });

    it('jsonToCsv handles empty array', () => {
        expect(conv.jsonToCsv([])).toBe('');
    });

    it('jsonToCsv quotes commas', () => {
        const csv = conv.jsonToCsv([{ name: 'Smith, John' }]);
        expect(csv).toContain('"Smith, John"');
    });

    it('csvToJson parses csv', () => {
        const result = conv.csvToJson('name,age\nAlice,30\nBob,25');
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('csvToJson handles empty', () => {
        expect(conv.csvToJson('')).toEqual([]);
    });

    it('jsonToKeyValue flattens', () => {
        const kv = conv.jsonToKeyValue({ a: 1, b: { c: 2 } });
        expect(kv).toContainEqual({ key: 'a', value: '1' });
        expect(kv).toContainEqual({ key: 'b.c', value: '2' });
    });

    it('keyValueToJson reconstructs', () => {
        const obj = conv.keyValueToJson([{ key: 'a.b', value: '1' }, { key: 'c', value: '2' }]);
        expect(obj).toEqual({ a: { b: '1' }, c: '2' });
    });

    it('flatten/unflatten roundtrip', () => {
        const original = { x: { y: { z: 'val' } }, a: 'b' };
        const flat = conv.flatten(original);
        expect(flat).toEqual({ 'x.y.z': 'val', 'a': 'b' });
        const unflat = conv.unflatten(flat);
        expect(unflat).toEqual({ x: { y: { z: 'val' } }, a: 'b' });
    });
});

// ─── Inverted Index ────────────────────────────────────────────

describe('Inverted Index — Phase 18', () => {
    let idx: InvertedIndex;

    beforeEach(() => {
        idx = new InvertedIndex();
        idx.add('doc1', 'body', 'The quick brown fox jumps over the lazy dog');
        idx.add('doc2', 'body', 'Quick brown foxes are fast');
        idx.add('doc3', 'body', 'Lazy dogs sleep all day');
    });

    it('searches single term', () => {
        const results = idx.search('quick');
        expect(results).toHaveLength(2);
        expect(results.map(r => r.docId)).toContain('doc1');
        expect(results.map(r => r.docId)).toContain('doc2');
    });

    it('returns empty for unknown term', () => {
        expect(idx.search('unicorn')).toEqual([]);
    });

    it('filters stopwords', () => {
        expect(idx.search('the')).toEqual([]);
        expect(idx.search('is')).toEqual([]);
    });

    it('searchAll returns intersection', () => {
        const docs = idx.searchAll(['quick', 'brown']);
        expect(docs).toContain('doc1');
        expect(docs).toContain('doc2');
    });

    it('searchAll with no match returns empty', () => {
        expect(idx.searchAll(['quick', 'unicorn'])).toEqual([]);
    });

    it('computes IDF', () => {
        const idf = idx.idf('lazy');
        expect(idf).toBeGreaterThan(0);
    });

    it('IDF for unknown is 0', () => {
        expect(idx.idf('unicorn')).toBe(0);
    });

    it('tracks doc count', () => {
        expect(idx.getDocCount()).toBe(3);
    });

    it('term count > 0', () => {
        expect(idx.termCount()).toBeGreaterThan(0);
    });

    it('custom stopword', () => {
        idx.addStopword('quick');
        idx.add('doc4', 'body', 'quick test');
        expect(idx.search('quick').map(r => r.docId)).not.toContain('doc4');
    });
});

// ─── PubSub ────────────────────────────────────────────────────

describe('PubSub — Phase 18', () => {
    let ps: PubSub;
    beforeEach(() => { ps = new PubSub(); });

    it('subscribe and publish', () => {
        const received: unknown[] = [];
        ps.subscribe('events', (_t, d) => received.push(d));
        const count = ps.publish('events', { msg: 'hello' });
        expect(count).toBe(1);
        expect(received).toEqual([{ msg: 'hello' }]);
    });

    it('unsubscribe stops delivery', () => {
        let calls = 0;
        const id = ps.subscribe('x', () => { calls++; });
        ps.unsubscribe(id);
        ps.publish('x', null);
        expect(calls).toBe(0);
    });

    it('unsubscribe unknown returns false', () => {
        expect(ps.unsubscribe('nonexistent')).toBe(false);
    });

    it('filter blocks messages', () => {
        const received: number[] = [];
        ps.subscribe('num', (_t, d) => received.push(d as number), (d) => (d as number) > 5);
        ps.publish('num', 3);
        ps.publish('num', 7);
        expect(received).toEqual([7]);
    });

    it('wildcard # matches all', () => {
        const received: string[] = [];
        ps.subscribe('#', (t) => received.push(t));
        ps.publish('events.user.login', null);
        expect(received).toContain('events.user.login');
    });

    it('wildcard * matches segment', () => {
        const received: string[] = [];
        ps.subscribe('events.*', (t) => received.push(t));
        ps.publish('events.login', null);
        ps.publish('events.logout', null);
        ps.publish('other.thing', null);
        expect(received).toEqual(['events.login', 'events.logout']);
    });

    it('partial wildcard with #', () => {
        const received: string[] = [];
        ps.subscribe('sys.#', (t) => received.push(t));
        ps.publish('sys.cpu.load', null);
        ps.publish('sys.mem', null);
        expect(received).toContain('sys.cpu.load');
        expect(received).toContain('sys.mem');
    });

    it('stats track published/delivered/filtered', () => {
        ps.subscribe('t', () => {});
        ps.subscribe('t', () => {}, () => false);
        ps.publish('t', null);
        const stats = ps.getStats();
        expect(stats.published).toBe(1);
        expect(stats.delivered).toBe(1);
        expect(stats.filtered).toBe(1);
    });

    it('listTopics returns topics', () => {
        ps.subscribe('a', () => {});
        ps.subscribe('b', () => {});
        expect(ps.listTopics()).toHaveLength(2);
    });

    it('count returns total subscriptions', () => {
        ps.subscribe('a', () => {});
        ps.subscribe('a', () => {});
        ps.subscribe('b', () => {});
        expect(ps.count()).toBe(3);
    });
});
