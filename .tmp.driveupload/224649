/**
 * plugins/dependency-graph.ts
 *
 * Plugin dependency resolution — builds a DAG of plugin dependencies,
 * performs topological sort for correct load order, detects cycles,
 * and validates version constraints.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:deps');

// ─── Types ───────────────────────────────────────────────────────

/** A dependency declaration in plugin.json */
export interface PluginDependency {
    /** Dependent plugin ID */
    pluginId: string;
    /** Semver version constraint (e.g., ">=1.0.0", "^2.0.0") */
    versionConstraint?: string;
    /** Optional: soft dependency (proceed without it) */
    optional?: boolean;
}

/** Dependency graph node */
export interface DependencyNode {
    id: string;
    version?: string;
    dependencies: PluginDependency[];
    dependents: string[];
}

/** Resolved load order result */
export interface LoadOrderResult {
    /** Topologically sorted plugin IDs (load in this order) */
    order: string[];
    /** Detected cycles */
    cycles: string[][];
    /** Missing required dependencies */
    missing: Array<{ pluginId: string; requiredBy: string; versionConstraint?: string }>;
    /** Optional dependencies that are missing */
    optionalMissing: Array<{ pluginId: string; requiredBy: string }>;
    /** All warnings */
    warnings: string[];
    /** True if load order is valid (no cycles, no missing required deps) */
    valid: boolean;
}

// ─── Semver Utilities ────────────────────────────────────────────

/** Parse semver into [major, minor, patch] */
export function parseSemver(version: string): [number, number, number] | null {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [parseInt(match[1]!, 10), parseInt(match[2]!, 10), parseInt(match[3]!, 10)];
}

/** Compare two semver tuples: -1, 0, 1 */
export function compareSemver(a: [number, number, number], b: [number, number, number]): number {
    for (let i = 0; i < 3; i++) {
        if (a[i]! < b[i]!) return -1;
        if (a[i]! > b[i]!) return 1;
    }
    return 0;
}

/** Check if a version satisfies a constraint */
export function satisfiesConstraint(version: string, constraint: string): boolean {
    const parsed = parseSemver(version);
    if (!parsed) return false;

    const trimmed = constraint.trim();

    // Exact match
    if (!trimmed.startsWith('>') && !trimmed.startsWith('<') && !trimmed.startsWith('^') && !trimmed.startsWith('~')) {
        const target = parseSemver(trimmed);
        return target ? compareSemver(parsed, target) === 0 : false;
    }

    // >=x.y.z
    if (trimmed.startsWith('>=')) {
        const target = parseSemver(trimmed.slice(2));
        return target ? compareSemver(parsed, target) >= 0 : false;
    }

    // >x.y.z
    if (trimmed.startsWith('>')) {
        const target = parseSemver(trimmed.slice(1));
        return target ? compareSemver(parsed, target) > 0 : false;
    }

    // <=x.y.z
    if (trimmed.startsWith('<=')) {
        const target = parseSemver(trimmed.slice(2));
        return target ? compareSemver(parsed, target) <= 0 : false;
    }

    // <x.y.z
    if (trimmed.startsWith('<')) {
        const target = parseSemver(trimmed.slice(1));
        return target ? compareSemver(parsed, target) < 0 : false;
    }

    // ^x.y.z — compatible (same major)
    if (trimmed.startsWith('^')) {
        const target = parseSemver(trimmed.slice(1));
        if (!target) return false;
        if (parsed[0] !== target[0]) return false;
        return compareSemver(parsed, target) >= 0;
    }

    // ~x.y.z — patch-level (same major.minor)
    if (trimmed.startsWith('~')) {
        const target = parseSemver(trimmed.slice(1));
        if (!target) return false;
        if (parsed[0] !== target[0] || parsed[1] !== target[1]) return false;
        return compareSemver(parsed, target) >= 0;
    }

    return false;
}

// ─── DependencyGraph ─────────────────────────────────────────────

/**
 * CoreBlow Plugin Dependency Graph
 *
 * Builds a directed acyclic graph from plugin dependency declarations,
 * performs topological sort for correct load order, detects cycles,
 * and validates version constraints.
 */
export class DependencyGraph {
    private nodes = new Map<string, DependencyNode>();

    /**
     * Add a plugin to the graph.
     */
    addPlugin(id: string, version?: string, dependencies?: PluginDependency[]): void {
        const existing = this.nodes.get(id);
        if (existing) {
            existing.version = version ?? existing.version;
            existing.dependencies = dependencies ?? existing.dependencies;
        } else {
            this.nodes.set(id, {
                id,
                version,
                dependencies: dependencies ?? [],
                dependents: [],
            });
        }

        // Update reverse edges
        for (const dep of (dependencies ?? [])) {
            const depNode = this.nodes.get(dep.pluginId);
            if (depNode && !depNode.dependents.includes(id)) {
                depNode.dependents.push(id);
            }
        }
    }

    /**
     * Remove a plugin from the graph.
     */
    removePlugin(id: string): void {
        const node = this.nodes.get(id);
        if (!node) return;

        // Remove from dependents lists
        for (const dep of node.dependencies) {
            const depNode = this.nodes.get(dep.pluginId);
            if (depNode) {
                depNode.dependents = depNode.dependents.filter((d) => d !== id);
            }
        }

        this.nodes.delete(id);
    }

    /**
     * Get a node by ID.
     */
    getNode(id: string): DependencyNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Get all nodes.
     */
    getNodes(): DependencyNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get direct dependencies of a plugin.
     */
    getDependencies(id: string): PluginDependency[] {
        return this.nodes.get(id)?.dependencies ?? [];
    }

    /**
     * Get plugins that depend on the given plugin.
     */
    getDependents(id: string): string[] {
        return this.nodes.get(id)?.dependents ?? [];
    }

    /**
     * Get transitive dependencies (all dependencies, recursively).
     */
    getTransitiveDependencies(id: string): string[] {
        const visited = new Set<string>();
        const collect = (nodeId: string) => {
            for (const dep of this.getDependencies(nodeId)) {
                if (!visited.has(dep.pluginId)) {
                    visited.add(dep.pluginId);
                    collect(dep.pluginId);
                }
            }
        };
        collect(id);
        return Array.from(visited);
    }

    /**
     * Resolve the correct load order via topological sort (Kahn's algorithm).
     * Also detects cycles, missing deps, and version mismatches.
     */
    resolveLoadOrder(): LoadOrderResult {
        const result: LoadOrderResult = {
            order: [],
            cycles: [],
            missing: [],
            optionalMissing: [],
            warnings: [],
            valid: true,
        };

        // Build adjacency and in-degree maps
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        for (const [id] of this.nodes) {
            inDegree.set(id, 0);
            adjacency.set(id, []);
        }

        for (const [id, node] of this.nodes) {
            for (const dep of node.dependencies) {
                const depNode = this.nodes.get(dep.pluginId);

                if (!depNode) {
                    if (dep.optional) {
                        result.optionalMissing.push({ pluginId: dep.pluginId, requiredBy: id });
                    } else {
                        result.missing.push({ pluginId: dep.pluginId, requiredBy: id, versionConstraint: dep.versionConstraint });
                        result.valid = false;
                    }
                    continue;
                }

                // Version check
                if (dep.versionConstraint && depNode.version) {
                    if (!satisfiesConstraint(depNode.version, dep.versionConstraint)) {
                        result.warnings.push(
                            `${id} requires ${dep.pluginId}@${dep.versionConstraint} but found ${depNode.version}`,
                        );
                    }
                }

                // dep.pluginId → id (dep must load before id)
                adjacency.get(dep.pluginId)!.push(id);
                inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
            }
        }

        // Kahn's algorithm
        const queue: string[] = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0) queue.push(id);
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            result.order.push(current);

            for (const neighbor of adjacency.get(current) ?? []) {
                const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, newDeg);
                if (newDeg === 0) queue.push(neighbor);
            }
        }

        // Detect cycles (nodes not in result)
        if (result.order.length < this.nodes.size) {
            result.valid = false;
            const inCycle = new Set<string>();
            for (const [id] of this.nodes) {
                if (!result.order.includes(id)) {
                    inCycle.add(id);
                }
            }
            if (inCycle.size > 0) {
                result.cycles.push(Array.from(inCycle));
                result.warnings.push(`Cycle detected among: ${Array.from(inCycle).join(', ')}`);
            }
        }

        return result;
    }

    /**
     * Check if unloading a plugin is safe (no active dependents).
     */
    canUnload(id: string): { safe: boolean; blockedBy: string[] } {
        const dependents = this.getDependents(id);
        return {
            safe: dependents.length === 0,
            blockedBy: dependents,
        };
    }

    /**
     * Get the unload order for a plugin and its dependents (reverse topological).
     */
    getUnloadOrder(id: string): string[] {
        const visited = new Set<string>();
        const order: string[] = [];

        const visit = (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            for (const dep of this.getDependents(nodeId)) {
                visit(dep);
            }
            order.push(nodeId);
        };

        visit(id);
        return order;
    }

    /** Number of plugins in the graph */
    size(): number {
        return this.nodes.size;
    }

    /** Clear the graph */
    clear(): void {
        this.nodes.clear();
    }
}
