/**
 * plugins/dependency-resolver.test.ts
 *
 * Comprehensive test suite for DependencyResolver and DependencyGraph.
 * Covers graph operations, topological sort, cycle detection, semver,
 * conflict detection, resolution strategies, upgrade planning,
 * compatibility matrix, visual graph, install simulation, orphans,
 * and health reports.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    DependencyGraph,
    parseSemver,
    compareSemver,
    satisfiesConstraint,
} from './dependency-graph.js';
import {
    DependencyResolver,
    type DependencyConflict,
} from './dependency-resolver.js';

// ─── DependencyGraph Tests ───────────────────────────────────────

describe('DependencyGraph', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
        graph = new DependencyGraph();
    });

    describe('node management', () => {
        it('should add a plugin', () => {
            graph.addPlugin('core', '1.0.0');
            expect(graph.size()).toBe(1);
            expect(graph.getNode('core')).toBeDefined();
        });

        it('should update existing plugin', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('core', '2.0.0');
            expect(graph.getNode('core')!.version).toBe('2.0.0');
        });

        it('should remove plugin', () => {
            graph.addPlugin('core', '1.0.0');
            graph.removePlugin('core');
            expect(graph.size()).toBe(0);
        });

        it('should get all nodes', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('b', '1.0.0');
            expect(graph.getNodes()).toHaveLength(2);
        });

        it('should clear graph', () => {
            graph.addPlugin('a');
            graph.addPlugin('b');
            graph.clear();
            expect(graph.size()).toBe(0);
        });
    });

    describe('dependencies', () => {
        it('should track dependencies', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(graph.getDependencies('auth')).toHaveLength(1);
        });

        it('should track dependents (reverse edges)', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(graph.getDependents('core')).toContain('auth');
        });

        it('should get transitive dependencies', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'db' }]);
            const transitive = graph.getTransitiveDependencies('auth');
            expect(transitive).toContain('db');
            expect(transitive).toContain('core');
        });

        it('should clean up reverse edges on remove', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            graph.removePlugin('auth');
            expect(graph.getDependents('core')).not.toContain('auth');
        });
    });

    describe('topological sort', () => {
        it('should return correct load order', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'db' }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(true);
            expect(result.order.indexOf('core')).toBeLessThan(result.order.indexOf('db'));
            expect(result.order.indexOf('db')).toBeLessThan(result.order.indexOf('auth'));
        });

        it('should detect cycles', () => {
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'b' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'a' }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(false);
            expect(result.cycles.length).toBeGreaterThan(0);
        });

        it('should report missing required dependencies', () => {
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
        });

        it('should report missing optional dependencies', () => {
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'cache', optional: true }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(true);
            expect(result.optionalMissing).toHaveLength(1);
        });

        it('should warn on version mismatch', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            const result = graph.resolveLoadOrder();
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('unload', () => {
        it('should check if unload is safe', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(graph.canUnload('core').safe).toBe(false);
            expect(graph.canUnload('auth').safe).toBe(true);
        });

        it('should get unload order', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const order = graph.getUnloadOrder('core');
            expect(order).toContain('core');
            expect(order).toContain('db');
            expect(order).toContain('auth');
        });
    });
});

// ─── Semver Tests ────────────────────────────────────────────────

describe('Semver Utilities', () => {
    describe('parseSemver', () => {
        it('should parse valid semver', () => {
            expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
        });

        it('should parse with v prefix', () => {
            expect(parseSemver('v2.0.0')).toEqual([2, 0, 0]);
        });

        it('should return null for invalid', () => {
            expect(parseSemver('invalid')).toBeNull();
        });
    });

    describe('compareSemver', () => {
        it('should return 0 for equal', () => {
            expect(compareSemver([1, 0, 0], [1, 0, 0])).toBe(0);
        });

        it('should return -1 for less', () => {
            expect(compareSemver([1, 0, 0], [2, 0, 0])).toBe(-1);
        });

        it('should return 1 for greater', () => {
            expect(compareSemver([2, 0, 0], [1, 0, 0])).toBe(1);
        });
    });

    describe('satisfiesConstraint', () => {
        it('should match exact version', () => {
            expect(satisfiesConstraint('1.0.0', '1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '2.0.0')).toBe(false);
        });

        it('should match >=', () => {
            expect(satisfiesConstraint('2.0.0', '>=1.0.0')).toBe(true);
            expect(satisfiesConstraint('0.9.0', '>=1.0.0')).toBe(false);
        });

        it('should match ^', () => {
            expect(satisfiesConstraint('1.5.0', '^1.0.0')).toBe(true);
            expect(satisfiesConstraint('2.0.0', '^1.0.0')).toBe(false);
        });

        it('should match ~', () => {
            expect(satisfiesConstraint('1.0.5', '~1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.1.0', '~1.0.0')).toBe(false);
        });

        it('should match >', () => {
            expect(satisfiesConstraint('2.0.0', '>1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '>1.0.0')).toBe(false);
        });

        it('should match <', () => {
            expect(satisfiesConstraint('0.9.0', '<1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '<1.0.0')).toBe(false);
        });

        it('should match <=', () => {
            expect(satisfiesConstraint('1.0.0', '<=1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.1', '<=1.0.0')).toBe(false);
        });
    });
});

// ─── DependencyResolver Tests ────────────────────────────────────

describe('DependencyResolver', () => {
    let graph: DependencyGraph;
    let resolver: DependencyResolver;

    beforeEach(() => {
        graph = new DependencyGraph();
        resolver = new DependencyResolver(graph);
    });

    // ════════════════════════════════════════════════════════════
    // Conflict Detection (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('conflict detection', () => {
        it('should detect version conflict', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core', versionConstraint: '^1.0.0' }]);
            const conflicts = resolver.detectConflicts();
            expect(conflicts.length).toBeGreaterThan(0);
            expect(conflicts[0].dependencyId).toBe('core');
        });

        it('should detect mutual exclusion conflict', () => {
            graph.addPlugin('mysql', '1.0.0');
            graph.addPlugin('postgres', '1.0.0');
            resolver.addExclusion('mysql', 'postgres');
            const conflicts = resolver.detectConflicts();
            expect(conflicts.some((c) => c.description.includes('Mutual exclusion'))).toBe(true);
        });

        it('should return empty when no conflicts', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '^1.0.0' }]);
            expect(resolver.detectConflicts()).toHaveLength(0);
        });

        it('should not conflict with single requirement', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(resolver.detectConflicts()).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Conflict Resolution (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('conflict resolution', () => {
        it('should resolve with newest-wins strategy', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=1.0.0' }]);
            resolver.setStrategy('newest-wins');
            const actions = resolver.resolveConflicts();
            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].action).toBe('upgrade');
        });

        it('should resolve with oldest-wins strategy', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=1.0.0' }]);
            resolver.setStrategy('oldest-wins');
            const actions = resolver.resolveConflicts();
            expect(actions[0].action).toBe('keep');
        });

        it('should return unresolved with manual strategy', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=1.0.0' }]);
            resolver.setStrategy('manual');
            const actions = resolver.resolveConflicts();
            expect(actions[0].action).toBe('unresolved');
        });

        it('should return unresolved with fail strategy', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=2.0.0' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'core', versionConstraint: '>=1.0.0' }]);
            resolver.setStrategy('fail');
            const actions = resolver.resolveConflicts();
            expect(actions[0].action).toBe('unresolved');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Upgrade Planning (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('upgrade planning', () => {
        it('should plan safe upgrade', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '^1.0.0' }]);
            const plan = resolver.planUpgrade('core', '1.5.0');
            expect(plan).not.toBeNull();
            expect(plan!.safe).toBe(true);
        });

        it('should detect breaking upgrade', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '~1.0.0' }]);
            const plan = resolver.planUpgrade('core', '2.0.0');
            expect(plan!.safe).toBe(false);
            expect(plan!.warnings.length).toBeGreaterThan(0);
        });

        it('should list impacted plugins', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            const plan = resolver.planUpgrade('core', '2.0.0');
            expect(plan!.impactedPlugins).toHaveLength(2);
        });

        it('should return null for unknown plugin', () => {
            expect(resolver.planUpgrade('nonexistent', '1.0.0')).toBeNull();
        });
    });

    // ════════════════════════════════════════════════════════════
    // Compatibility Matrix (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('compatibility matrix', () => {
        it('should generate matrix', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('b', '1.0.0');
            graph.addPlugin('c', '1.0.0');
            const matrix = resolver.getCompatibilityMatrix();
            expect(matrix).toHaveLength(3); // C(3,2) = 3 pairs
        });

        it('should mark excluded pairs as incompatible', () => {
            graph.addPlugin('mysql', '1.0.0');
            graph.addPlugin('postgres', '1.0.0');
            resolver.addExclusion('mysql', 'postgres');
            const matrix = resolver.getCompatibilityMatrix();
            expect(matrix[0].compatible).toBe(false);
        });

        it('should mark all pairs compatible without exclusions', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('b', '1.0.0');
            const matrix = resolver.getCompatibilityMatrix();
            expect(matrix.every((e) => e.compatible)).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Visual Graph (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('visual graph', () => {
        it('should generate nodes and edges', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const visual = resolver.getVisualGraph();
            expect(visual.nodes).toHaveLength(2);
            expect(visual.edges).toHaveLength(1);
        });

        it('should identify roots', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const visual = resolver.getVisualGraph();
            expect(visual.roots).toContain('core');
        });

        it('should identify leafs', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const visual = resolver.getVisualGraph();
            expect(visual.leafs).toContain('auth');
        });

        it('should include missing dependency nodes', () => {
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const visual = resolver.getVisualGraph();
            expect(visual.nodes.find((n) => n.id === 'core')).toBeDefined();
            expect(visual.nodes.find((n) => n.id === 'core')!.type).toBe('missing');
        });

        it('should mark edge satisfaction', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '^1.0.0' }]);
            const visual = resolver.getVisualGraph();
            expect(visual.edges[0].satisfied).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Install Simulation (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('install simulation', () => {
        it('should simulate successful install', () => {
            graph.addPlugin('core', '1.0.0');
            const sim = resolver.simulateInstall('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(sim.canInstall).toBe(true);
        });

        it('should detect missing dependencies', () => {
            const sim = resolver.simulateInstall('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(sim.canInstall).toBe(false);
            expect(sim.missingDependencies).toHaveLength(1);
        });

        it('should provide install order', () => {
            graph.addPlugin('core', '1.0.0');
            const sim = resolver.simulateInstall('auth', '1.0.0', [{ pluginId: 'core' }]);
            expect(sim.installOrder.indexOf('core')).toBeLessThan(sim.installOrder.indexOf('auth'));
        });
    });

    // ════════════════════════════════════════════════════════════
    // Orphan Detection (2 tests)
    // ════════════════════════════════════════════════════════════

    describe('orphan detection', () => {
        it('should detect orphan plugins', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const orphans = resolver.detectOrphans();
            expect(orphans).toContain('auth');
        });

        it('should not mark standalone plugins as orphans', () => {
            graph.addPlugin('standalone', '1.0.0');
            const orphans = resolver.detectOrphans();
            expect(orphans).not.toContain('standalone');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Health Report (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('health report', () => {
        it('should report healthy graph', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const health = resolver.getHealthReport();
            expect(health.healthy).toBe(true);
            expect(health.score).toBeGreaterThan(90);
        });

        it('should report unhealthy for missing deps', () => {
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const health = resolver.getHealthReport();
            expect(health.healthy).toBe(false);
            expect(health.missingRequired).toBe(1);
        });

        it('should include total metrics', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
            const health = resolver.getHealthReport();
            expect(health.totalPlugins).toBe(2);
            expect(health.totalEdges).toBe(1);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Exclusions & Strategy (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('exclusions and strategy', () => {
        it('should add exclusion', () => {
            resolver.addExclusion('mysql', 'postgres');
            expect(resolver.getExclusions()).toHaveLength(1);
        });

        it('should remove exclusion', () => {
            resolver.addExclusion('mysql', 'postgres');
            expect(resolver.removeExclusion('mysql', 'postgres')).toBe(true);
            expect(resolver.getExclusions()).toHaveLength(0);
        });

        it('should get strategy', () => {
            expect(resolver.getStrategy()).toBe('newest-wins');
        });

        it('should set strategy', () => {
            resolver.setStrategy('manual');
            expect(resolver.getStrategy()).toBe('manual');
        });
    });
});
