import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './dependency-graph.js';

describe('DependencyGraph', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
        graph = new DependencyGraph();
    });

    // === Node Management ===

    describe('addNode', () => {
        it('adds a node', () => {
            graph.addNode('a', 'Module A', 'service');
            expect(graph.getNode('a')?.label).toBe('Module A');
        });

        it('does not overwrite existing node', () => {
            graph.addNode('a', 'First', 'service');
            graph.addNode('a', 'Second', 'service');
            expect(graph.getNode('a')?.label).toBe('First');
        });

        it('getNode returns null for missing', () => {
            expect(graph.getNode('missing')).toBeNull();
        });
    });

    // === Edges ===

    describe('addEdge', () => {
        it('creates dependency relationship', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            expect(graph.addEdge('a', 'b')).toBe(true);
            expect(graph.getNode('a')?.dependencies).toContain('b');
            expect(graph.getNode('b')?.dependents).toContain('a');
        });

        it('returns false for missing node', () => {
            graph.addNode('a', 'A', 's');
            expect(graph.addEdge('a', 'missing')).toBe(false);
        });

        it('does not add duplicate edges', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addEdge('a', 'b');
            graph.addEdge('a', 'b');
            expect(graph.getNode('a')?.dependencies.filter(d => d === 'b')).toHaveLength(1);
        });
    });

    // === Topological Sort ===

    describe('topologicalSort', () => {
        it('returns dependencies before dependents', () => {
            graph.addNode('app', 'App', 's');
            graph.addNode('db', 'Database', 's');
            graph.addNode('cache', 'Cache', 's');
            graph.addEdge('app', 'db');
            graph.addEdge('app', 'cache');

            const sorted = graph.topologicalSort();
            expect(sorted.indexOf('db')).toBeLessThan(sorted.indexOf('app'));
            expect(sorted.indexOf('cache')).toBeLessThan(sorted.indexOf('app'));
        });

        it('handles linear chain', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addNode('c', 'C', 's');
            graph.addEdge('a', 'b');
            graph.addEdge('b', 'c');

            const sorted = graph.topologicalSort();
            expect(sorted).toEqual(['c', 'b', 'a']);
        });

        it('handles independent nodes', () => {
            graph.addNode('x', 'X', 's');
            graph.addNode('y', 'Y', 's');
            const sorted = graph.topologicalSort();
            expect(sorted).toHaveLength(2);
        });
    });

    // === Cycle Detection ===

    describe('detectCycles', () => {
        it('returns empty for acyclic graph', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addEdge('a', 'b');
            expect(graph.detectCycles()).toHaveLength(0);
        });

        it('detects simple cycle', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addEdge('a', 'b');
            graph.addEdge('b', 'a');
            const cycles = graph.detectCycles();
            expect(cycles.length).toBeGreaterThan(0);
        });

        it('detects three-node cycle', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addNode('c', 'C', 's');
            graph.addEdge('a', 'b');
            graph.addEdge('b', 'c');
            graph.addEdge('c', 'a');
            const cycles = graph.detectCycles();
            expect(cycles.length).toBeGreaterThan(0);
        });
    });

    // === Impact Analysis ===

    describe('analyzeImpact', () => {
        it('finds direct dependents', () => {
            graph.addNode('lib', 'Lib', 's');
            graph.addNode('app', 'App', 's');
            graph.addEdge('app', 'lib');

            const impact = graph.analyzeImpact('lib');
            expect(impact.directDependents).toContain('app');
            expect(impact.totalImpacted).toBe(1);
        });

        it('finds transitive dependents', () => {
            graph.addNode('core', 'Core', 's');
            graph.addNode('lib', 'Lib', 's');
            graph.addNode('app', 'App', 's');
            graph.addEdge('lib', 'core');
            graph.addEdge('app', 'lib');

            const impact = graph.analyzeImpact('core');
            expect(impact.transitiveDependents).toContain('lib');
            expect(impact.transitiveDependents).toContain('app');
            expect(impact.totalImpacted).toBe(2);
        });

        it('returns empty for missing node', () => {
            const impact = graph.analyzeImpact('ghost');
            expect(impact.totalImpacted).toBe(0);
        });

        it('returns empty for leaf node', () => {
            graph.addNode('leaf', 'Leaf', 's');
            const impact = graph.analyzeImpact('leaf');
            expect(impact.totalImpacted).toBe(0);
        });
    });

    // === Listing ===

    describe('list and count', () => {
        it('lists all nodes with dependency counts', () => {
            graph.addNode('a', 'A', 's');
            graph.addNode('b', 'B', 's');
            graph.addEdge('a', 'b');

            const list = graph.list();
            expect(list).toHaveLength(2);
            const nodeA = list.find(n => n.id === 'a');
            expect(nodeA?.deps).toBe(1);
        });

        it('count returns node count', () => {
            graph.addNode('x', 'X', 's');
            graph.addNode('y', 'Y', 's');
            expect(graph.count()).toBe(2);
        });
    });
});
