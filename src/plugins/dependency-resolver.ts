/**
 * plugins/dependency-resolver.ts
 *
 * Plugin Dependency Resolver — Higher-level conflict resolution,
 * upgrade planning, compatibility matrix, and visual graph data
 * for the admin dependency UI.
 *
 * Following CoreBlow's dependency resolution patterns upgraded
 * to CoreBlow OOP with:
 *   - Conflict detection (version mismatches, mutual exclusions)
 *   - Conflict resolution strategies (newest-wins, manual, fail)
 *   - Upgrade planning with impact analysis
 *   - Compatibility matrix generation
 *   - Visual graph data export (nodes + edges for UI rendering)
 *   - Install simulation (dry-run dependency check)
 *   - Orphan detection (plugins with no dependents that aren't roots)
 */

import { clamp } from "../utils.js";
import { createChildLogger } from '../utils/logger.js';
import {
    DependencyGraph,
    satisfiesConstraint,
    type PluginDependency,
    type DependencyNode,
    type LoadOrderResult,
} from './dependency-graph.js';

const log = createChildLogger('plugin:dep-resolver');

// ─── Types ───────────────────────────────────────────────────────

/** Conflict between two plugins' dependency requirements */
export interface DependencyConflict {
    /** The dependency that is conflicted */
    dependencyId: string;
    /** Plugins that require conflicting versions */
    requiredBy: Array<{
        pluginId: string;
        versionConstraint?: string;
    }>;
    /** The installed version (if any) */
    installedVersion?: string;
    /** Severity */
    severity: 'error' | 'warn';
    /** Human-readable description */
    description: string;
}

/** Conflict resolution strategy */
export type ResolutionStrategy = 'newest-wins' | 'oldest-wins' | 'manual' | 'fail';

/** Resolution action for a conflict */
export interface ResolutionAction {
    conflict: DependencyConflict;
    action: 'upgrade' | 'downgrade' | 'keep' | 'unresolved';
    targetVersion?: string;
    reason: string;
}

/** Upgrade plan for a plugin */
export interface UpgradePlan {
    pluginId: string;
    fromVersion: string;
    toVersion: string;
    /** Plugins that will be affected by this upgrade */
    impactedPlugins: string[];
    /** Whether the upgrade is safe (no breaking changes for dependents) */
    safe: boolean;
    /** Warnings about the upgrade */
    warnings: string[];
}

/** Compatibility entry between two plugins */
export interface CompatibilityEntry {
    pluginA: string;
    pluginB: string;
    compatible: boolean;
    reason?: string;
}

/** Visual graph node for UI rendering */
export interface GraphNode {
    id: string;
    label: string;
    version?: string;
    type: 'installed' | 'missing' | 'optional-missing';
    dependencyCount: number;
    dependentCount: number;
    /** Depth from root (0 = root plugin) */
    depth: number;
}

/** Visual graph edge for UI rendering */
export interface GraphEdge {
    from: string;
    to: string;
    type: 'required' | 'optional';
    versionConstraint?: string;
    satisfied: boolean;
}

/** Visual graph data for rendering */
export interface VisualGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    roots: string[];
    leafs: string[];
    maxDepth: number;
}

/** Install simulation result */
export interface InstallSimulation {
    pluginId: string;
    canInstall: boolean;
    missingDependencies: Array<{ pluginId: string; versionConstraint?: string }>;
    conflicts: DependencyConflict[];
    installOrder: string[];
    warnings: string[];
}

/** Dependency health report */
export interface DependencyHealth {
    totalPlugins: number;
    totalEdges: number;
    conflicts: DependencyConflict[];
    orphans: string[];
    cycles: string[][];
    missingRequired: number;
    missingOptional: number;
    healthy: boolean;
    score: number; // 0-100
}

// ─── DependencyResolver ──────────────────────────────────────────

/**
 * CoreBlow Plugin Dependency Resolver
 *
 * Higher-level layer on top of DependencyGraph that provides
 * conflict resolution, upgrade planning, compatibility matrix,
 * visual graph data, and admin UI APIs.
 */
export class DependencyResolver {
    private graph: DependencyGraph;
    private strategy: ResolutionStrategy;
    /** Mutual exclusion rules (pluginA cannot coexist with pluginB) */
    private exclusions: Array<[string, string]> = [];

    constructor(graph?: DependencyGraph, strategy: ResolutionStrategy = 'newest-wins') {
        this.graph = graph ?? new DependencyGraph();
        this.strategy = strategy;
    }

    // ─── Conflict Detection ──────────────────────────────────────

    /**
     * Detect all dependency conflicts in the graph.
     */
    detectConflicts(): DependencyConflict[] {
        const conflicts: DependencyConflict[] = [];
        const requirementsByDep = new Map<string, Array<{ pluginId: string; versionConstraint?: string }>>();

        // Collect all version requirements per dependency
        for (const node of this.graph.getNodes()) {
            for (const dep of node.dependencies) {
                const list = requirementsByDep.get(dep.pluginId) ?? [];
                list.push({ pluginId: node.id, versionConstraint: dep.versionConstraint });
                requirementsByDep.set(dep.pluginId, list);
            }
        }

        // Check for version conflicts
        for (const [depId, requirements] of requirementsByDep) {
            if (requirements.length < 2) continue;

            const depNode = this.graph.getNode(depId);
            const installedVersion = depNode?.version;

            // Check if installed version satisfies all constraints
            const unsatisfied = requirements.filter((r) => {
                if (!r.versionConstraint || !installedVersion) return false;
                return !satisfiesConstraint(installedVersion, r.versionConstraint);
            });

            if (unsatisfied.length > 0) {
                conflicts.push({
                    dependencyId: depId,
                    requiredBy: requirements,
                    installedVersion,
                    severity: 'error',
                    description: `Version conflict for ${depId}: installed ${installedVersion ?? 'none'}, required by ${unsatisfied.map((u) => `${u.pluginId}@${u.versionConstraint}`).join(', ')}`,
                });
            }
        }

        // Check mutual exclusions
        for (const [a, b] of this.exclusions) {
            const nodeA = this.graph.getNode(a);
            const nodeB = this.graph.getNode(b);
            if (nodeA && nodeB) {
                conflicts.push({
                    dependencyId: a,
                    requiredBy: [{ pluginId: a }, { pluginId: b }],
                    severity: 'error',
                    description: `Mutual exclusion: ${a} and ${b} cannot coexist`,
                });
            }
        }

        return conflicts;
    }

    // ─── Conflict Resolution ─────────────────────────────────────

    /**
     * Attempt to resolve detected conflicts.
     */
    resolveConflicts(conflicts?: DependencyConflict[]): ResolutionAction[] {
        const toResolve = conflicts ?? this.detectConflicts();
        const actions: ResolutionAction[] = [];

        for (const conflict of toResolve) {
            switch (this.strategy) {
                case 'newest-wins': {
                    // Pick the highest version constraint
                    const versions = conflict.requiredBy
                        .map((r) => r.versionConstraint)
                        .filter(Boolean) as string[];
                    const target = versions.length > 0 ? versions[versions.length - 1] : undefined;
                    actions.push({
                        conflict,
                        action: 'upgrade',
                        targetVersion: target,
                        reason: `Newest-wins: upgrading ${conflict.dependencyId} to satisfy latest constraint`,
                    });
                    break;
                }
                case 'oldest-wins': {
                    const versions = conflict.requiredBy
                        .map((r) => r.versionConstraint)
                        .filter(Boolean) as string[];
                    const target = versions.length > 0 ? versions[0] : undefined;
                    actions.push({
                        conflict,
                        action: 'keep',
                        targetVersion: target,
                        reason: `Oldest-wins: keeping ${conflict.dependencyId} at earliest constraint`,
                    });
                    break;
                }
                case 'manual':
                    actions.push({
                        conflict,
                        action: 'unresolved',
                        reason: 'Manual resolution required',
                    });
                    break;
                case 'fail':
                    actions.push({
                        conflict,
                        action: 'unresolved',
                        reason: `Conflict resolution disabled: ${conflict.description}`,
                    });
                    break;
            }
        }

        return actions;
    }

    // ─── Upgrade Planning ────────────────────────────────────────

    /**
     * Plan an upgrade for a plugin.
     */
    planUpgrade(pluginId: string, toVersion: string): UpgradePlan | null {
        const node = this.graph.getNode(pluginId);
        if (!node) return null;

        const fromVersion = node.version ?? '0.0.0';
        const dependents = this.graph.getDependents(pluginId);
        const warnings: string[] = [];

        // Check if dependents' constraints will be satisfied
        const impactedPlugins: string[] = [];
        let safe = true;

        for (const depId of dependents) {
            const depNode = this.graph.getNode(depId);
            if (!depNode) continue;

            const constraint = depNode.dependencies.find((d) => d.pluginId === pluginId);
            if (constraint?.versionConstraint) {
                if (!satisfiesConstraint(toVersion, constraint.versionConstraint)) {
                    warnings.push(`${depId} requires ${pluginId}@${constraint.versionConstraint}, but upgrade to ${toVersion} breaks this`);
                    safe = false;
                }
            }
            impactedPlugins.push(depId);
        }

        return { pluginId, fromVersion, toVersion, impactedPlugins, safe, warnings };
    }

    // ─── Compatibility Matrix ────────────────────────────────────

    /**
     * Generate a compatibility matrix for all plugins.
     */
    getCompatibilityMatrix(): CompatibilityEntry[] {
        const entries: CompatibilityEntry[] = [];
        const nodeIds = this.graph.getNodes().map((n) => n.id);

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = nodeIds[i];
                const b = nodeIds[j];

                // Check mutual exclusion
                const excluded = this.exclusions.some(
                    ([x, y]) => (x === a && y === b) || (x === b && y === a),
                );

                if (excluded) {
                    entries.push({ pluginA: a, pluginB: b, compatible: false, reason: 'Mutual exclusion' });
                } else {
                    entries.push({ pluginA: a, pluginB: b, compatible: true });
                }
            }
        }

        return entries;
    }

    // ─── Visual Graph ────────────────────────────────────────────

    /**
     * Generate visual graph data for UI rendering.
     */
    getVisualGraph(): VisualGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const depthMap = new Map<string, number>();
        const loadOrder = this.graph.resolveLoadOrder();

        // Compute depths via BFS from roots
        const roots = this.graph.getNodes()
            .filter((n) => n.dependencies.length === 0)
            .map((n) => n.id);

        const queue: Array<{ id: string; depth: number }> = roots.map((id) => ({ id, depth: 0 }));
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);
            depthMap.set(id, depth);

            for (const dependent of this.graph.getDependents(id)) {
                if (!visited.has(dependent)) {
                    queue.push({ id: dependent, depth: depth + 1 });
                }
            }
        }

        // Build nodes
        const allNodeIds = new Set<string>();
        for (const node of this.graph.getNodes()) {
            allNodeIds.add(node.id);
            nodes.push({
                id: node.id,
                label: node.id,
                version: node.version,
                type: 'installed',
                dependencyCount: node.dependencies.length,
                dependentCount: node.dependents.length,
                depth: depthMap.get(node.id) ?? 0,
            });
        }

        // Add missing dependency nodes
        for (const missing of loadOrder.missing) {
            if (!allNodeIds.has(missing.pluginId)) {
                allNodeIds.add(missing.pluginId);
                nodes.push({
                    id: missing.pluginId,
                    label: missing.pluginId,
                    type: 'missing',
                    dependencyCount: 0,
                    dependentCount: 1,
                    depth: -1,
                });
            }
        }

        for (const optMissing of loadOrder.optionalMissing) {
            if (!allNodeIds.has(optMissing.pluginId)) {
                allNodeIds.add(optMissing.pluginId);
                nodes.push({
                    id: optMissing.pluginId,
                    label: optMissing.pluginId,
                    type: 'optional-missing',
                    dependencyCount: 0,
                    dependentCount: 1,
                    depth: -1,
                });
            }
        }

        // Build edges
        for (const node of this.graph.getNodes()) {
            for (const dep of node.dependencies) {
                const depNode = this.graph.getNode(dep.pluginId);
                const satisfied = depNode
                    ? (!dep.versionConstraint || !depNode.version || satisfiesConstraint(depNode.version, dep.versionConstraint))
                    : false;

                edges.push({
                    from: node.id,
                    to: dep.pluginId,
                    type: dep.optional ? 'optional' : 'required',
                    versionConstraint: dep.versionConstraint,
                    satisfied,
                });
            }
        }

        const leafs = this.graph.getNodes()
            .filter((n) => n.dependents.length === 0 && n.dependencies.length > 0)
            .map((n) => n.id);

        const maxDepth = Math.max(0, ...Array.from(depthMap.values()));

        return { nodes, edges, roots, leafs, maxDepth };
    }

    // ─── Install Simulation ──────────────────────────────────────

    /**
     * Simulate installing a plugin to check dependency satisfaction.
     */
    simulateInstall(
        pluginId: string,
        version: string,
        dependencies: PluginDependency[],
    ): InstallSimulation {
        // Create a temporary graph clone
        const tempGraph = new DependencyGraph();
        for (const node of this.graph.getNodes()) {
            tempGraph.addPlugin(node.id, node.version, node.dependencies);
        }
        tempGraph.addPlugin(pluginId, version, dependencies);

        const tempResolver = new DependencyResolver(tempGraph, this.strategy);
        const loadOrder = tempGraph.resolveLoadOrder();
        const conflicts = tempResolver.detectConflicts();

        const missingDeps = dependencies.filter((d) => {
            if (d.optional) return false;
            return !this.graph.getNode(d.pluginId);
        });

        return {
            pluginId,
            canInstall: loadOrder.valid && conflicts.length === 0 && missingDeps.length === 0,
            missingDependencies: missingDeps.map((d) => ({ pluginId: d.pluginId, versionConstraint: d.versionConstraint })),
            conflicts,
            installOrder: loadOrder.order,
            warnings: loadOrder.warnings,
        };
    }

    // ─── Orphan Detection ────────────────────────────────────────

    /**
     * Detect orphan plugins (no dependents and not a root/standalone plugin).
     */
    detectOrphans(): string[] {
        return this.graph.getNodes()
            .filter((n) => n.dependents.length === 0 && n.dependencies.length > 0)
            .map((n) => n.id);
    }

    // ─── Health Report ───────────────────────────────────────────

    /**
     * Generate a dependency health report.
     */
    getHealthReport(): DependencyHealth {
        const loadOrder = this.graph.resolveLoadOrder();
        const conflicts = this.detectConflicts();
        const orphans = this.detectOrphans();

        let totalEdges = 0;
        for (const node of this.graph.getNodes()) {
            totalEdges += node.dependencies.length;
        }

        // Score: start at 100, deduct for issues
        let score = 100;
        score -= conflicts.length * 15;
        score -= loadOrder.cycles.length * 25;
        score -= loadOrder.missing.length * 10;
        score -= orphans.length * 2;
        score = clamp(score, 0, 100);

        return {
            totalPlugins: this.graph.size(),
            totalEdges,
            conflicts,
            orphans,
            cycles: loadOrder.cycles,
            missingRequired: loadOrder.missing.length,
            missingOptional: loadOrder.optionalMissing.length,
            healthy: conflicts.length === 0 && loadOrder.cycles.length === 0 && loadOrder.missing.length === 0,
            score,
        };
    }

    // ─── Exclusions ──────────────────────────────────────────────

    /**
     * Add a mutual exclusion rule.
     */
    addExclusion(pluginA: string, pluginB: string): void {
        this.exclusions.push([pluginA, pluginB]);
    }

    /**
     * Remove a mutual exclusion rule.
     */
    removeExclusion(pluginA: string, pluginB: string): boolean {
        const before = this.exclusions.length;
        this.exclusions = this.exclusions.filter(
            ([a, b]) => !(a === pluginA && b === pluginB) && !(a === pluginB && b === pluginA),
        );
        return this.exclusions.length < before;
    }

    /**
     * Get all exclusion rules.
     */
    getExclusions(): Array<[string, string]> {
        return [...this.exclusions];
    }

    // ─── Strategy ────────────────────────────────────────────────

    /**
     * Get current resolution strategy.
     */
    getStrategy(): ResolutionStrategy {
        return this.strategy;
    }

    /**
     * Set resolution strategy.
     */
    setStrategy(strategy: ResolutionStrategy): void {
        this.strategy = strategy;
    }

    // ─── Accessors ───────────────────────────────────────────────

    getGraph(): DependencyGraph {
        return this.graph;
    }
}
