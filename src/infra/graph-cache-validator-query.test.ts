import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './dependency-graph.js';
import { LRUCache } from './lru-cache.js';
import { DataValidator } from './data-validator.js';
import { QueryParser } from './query-parser.js';

// ─── Dependency Graph ──────────────────────────────────────────

describe('Dependency Graph — Phase 18', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
        graph = new DependencyGraph();
        graph.addNode('a', 'Module A', 'core');
        graph.addNode('b', 'Module B', 'core');
        graph.addNode('c', 'Module C', 'util');
        graph.addEdge('b', 'a'); // B depends on A
        graph.addEdge('c', 'b'); // C depends on B
    });

    it('adds nodes and edges', () => {
        expect(graph.count()).toBe(3);
        expect(graph.getNode('a')!.dependents).toContain('b');
        expect(graph.getNode('b')!.dependencies).toContain('a');
    });

    it('addEdge returns false for unknown nodes', () => {
        expect(graph.addEdge('x', 'y')).toBe(false);
    });

    it('topological sort orders dependencies first', () => {
        const sorted = graph.topologicalSort();
        expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
        expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
    });

    it('detects no cycles in DAG', () => {
        expect(graph.detectCycles()).toHaveLength(0);
    });

    it('detects cycles', () => {
        graph.addEdge('a', 'c'); // A→C creates C→B→A→C cycle
        const cycles = graph.detectCycles();
        expect(cycles.length).toBeGreaterThan(0);
    });

    it('analyzes impact', () => {
        const impact = graph.analyzeImpact('a');
        expect(impact.directDependents).toContain('b');
        expect(impact.transitiveDependents).toContain('c');
        expect(impact.totalImpacted).toBe(2);
    });

    it('impact of leaf node is 0', () => {
        const impact = graph.analyzeImpact('c');
        expect(impact.totalImpacted).toBe(0);
    });

    it('impact of unknown returns empty', () => {
        expect(graph.analyzeImpact('x').totalImpacted).toBe(0);
    });

    it('list returns all nodes', () => {
        const list = graph.list();
        expect(list).toHaveLength(3);
        expect(list.find(n => n.id === 'a')!.dependents).toBe(1);
    });

    it('getNode returns null for unknown', () => {
        expect(graph.getNode('z')).toBeNull();
    });
});

// ─── LRU Cache ─────────────────────────────────────────────────

describe('LRU Cache — Phase 18', () => {
    it('get/set basic operations', () => {
        const cache = new LRUCache<string>(3);
        cache.set('a', 'alpha');
        expect(cache.get('a')).toBe('alpha');
        expect(cache.has('a')).toBe(true);
    });

    it('returns undefined for miss', () => {
        const cache = new LRUCache<string>(3);
        expect(cache.get('x')).toBeUndefined();
    });

    it('evicts LRU on overflow', () => {
        const cache = new LRUCache<string>(3);
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('c', '3');
        cache.set('d', '4'); // evicts 'a'
        expect(cache.get('a')).toBeUndefined();
        expect(cache.size()).toBe(3);
    });

    it('access promotes entry', () => {
        const cache = new LRUCache<string>(3);
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('c', '3');
        cache.get('a'); // promote 'a'
        cache.set('d', '4'); // evicts 'b' (now oldest)
        expect(cache.get('a')).toBe('1');
        expect(cache.get('b')).toBeUndefined();
    });

    it('TTL expires entries', () => {
        const cache = new LRUCache<string>(10);
        cache.set('x', 'val', -1); // already expired
        expect(cache.get('x')).toBeUndefined();
        expect(cache.has('x')).toBe(false);
    });

    it('delete removes entry', () => {
        const cache = new LRUCache<string>(10);
        cache.set('a', '1');
        cache.delete('a');
        expect(cache.has('a')).toBe(false);
    });

    it('clear removes all', () => {
        const cache = new LRUCache<string>(10);
        cache.set('a', '1');
        cache.set('b', '2');
        cache.clear();
        expect(cache.size()).toBe(0);
    });

    it('stats track hits/misses/evictions', () => {
        const cache = new LRUCache<string>(2);
        cache.set('a', '1');
        cache.get('a'); // hit
        cache.get('b'); // miss
        cache.set('b', '2');
        cache.set('c', '3'); // evicts 'a'
        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.evictions).toBe(1);
        expect(stats.hitRate).toBeCloseTo(0.5);
    });
});

// ─── Data Validator ────────────────────────────────────────────

describe('Data Validator — Phase 18', () => {
    it('required rule', () => {
        const v = new DataValidator().required('name');
        expect(v.validate({ name: 'Alice' }).valid).toBe(true);
        expect(v.validate({}).valid).toBe(false);
        expect(v.validate({ name: '' }).valid).toBe(false);
    });

    it('minLength rule', () => {
        const v = new DataValidator().minLength('pw', 8);
        expect(v.validate({ pw: 'longpassword' }).valid).toBe(true);
        expect(v.validate({ pw: 'short' }).valid).toBe(false);
    });

    it('max rule', () => {
        const v = new DataValidator().max('age', 120);
        expect(v.validate({ age: 25 }).valid).toBe(true);
        expect(v.validate({ age: 200 }).valid).toBe(false);
    });

    it('pattern rule', () => {
        const v = new DataValidator().pattern('email', /^.+@.+\..+$/);
        expect(v.validate({ email: 'a@b.com' }).valid).toBe(true);
        expect(v.validate({ email: 'invalid' }).valid).toBe(false);
    });

    it('custom rule', () => {
        const v = new DataValidator().custom('val', (v) => v === 42);
        expect(v.validate({ val: 42 }).valid).toBe(true);
        expect(v.validate({ val: 0 }).valid).toBe(false);
    });

    it('chained rules', () => {
        const v = new DataValidator()
            .required('name')
            .minLength('name', 2)
            .max('age', 150);
        const result = v.validate({ name: 'A', age: 200 });
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
    });

    it('validateMany returns only invalid', () => {
        const v = new DataValidator().required('name');
        const results = v.validateMany([{ name: 'ok' }, {}, { name: 'fine' }]);
        expect(results).toHaveLength(1);
        expect(results[0].index).toBe(1);
    });

    it('reset clears rules', () => {
        const v = new DataValidator().required('x');
        expect(v.count()).toBe(1);
        v.reset();
        expect(v.count()).toBe(0);
    });
});

// ─── Query Parser ──────────────────────────────────────────────

describe('Query Parser — Phase 18', () => {
    let parser: QueryParser;
    beforeEach(() => { parser = new QueryParser(); });

    it('parses simple terms', () => {
        const result = parser.parse('hello world');
        expect(result.terms).toEqual(['hello', 'world']);
    });

    it('parses quoted phrases', () => {
        const result = parser.parse('"hello world"');
        expect(result.phrases).toEqual(['hello world']);
    });

    it('parses field filters', () => {
        const result = parser.parse('type:error status:500');
        expect(result.filters).toEqual([
            { field: 'type', value: 'error' },
            { field: 'status', value: '500' },
        ]);
    });

    it('parses negation', () => {
        const result = parser.parse('-debug -test');
        expect(result.negations).toEqual(['debug', 'test']);
    });

    it('parses boolean operators', () => {
        const result = parser.parse('error AND fatal');
        expect(result.tokens[1]).toEqual({ type: 'operator', value: 'AND' });
    });

    it('parses complex query', () => {
        const result = parser.parse('type:error "stack trace" -debug OR warning');
        expect(result.filters).toHaveLength(1);
        expect(result.phrases).toEqual(['stack trace']);
        expect(result.negations).toEqual(['debug']);
        expect(result.terms).toContain('warning');
    });

    it('stringify roundtrips', () => {
        const parsed = parser.parse('hello "world" type:info -debug AND error');
        const str = parser.stringify(parsed);
        expect(str).toContain('hello');
        expect(str).toContain('"world"');
        expect(str).toContain('type:info');
        expect(str).toContain('-debug');
    });

    it('handles empty query', () => {
        const result = parser.parse('');
        expect(result.terms).toEqual([]);
        expect(result.tokens).toEqual([]);
    });
});
