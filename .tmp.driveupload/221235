/**
 * CoreBlow — Dependency Graph
 *
 * Tracks module dependencies and provides topological
 * sorting, circular dependency detection, and impact
 * analysis for changes.
 */

/** Graph node */
export interface GraphNode {
    id: string;
    label: string;
    type: string;
    dependencies: string[];
    dependents: string[];
    metadata?: Record<string, unknown>;
}

/** Impact analysis result */
export interface ImpactAnalysis {
    directDependents: string[];
    transitiveDependents: string[];
    totalImpacted: number;
}

/**
 * CoreBlow Dependency Graph
 */
export class DependencyGraph {
    private nodes = new Map<string, GraphNode>();

    /**
     * Add a node.
     */
    addNode(id: string, label: string, type: string): void {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, { id, label, type, dependencies: [], dependents: [] });
        }
    }

    /**
     * Add a dependency edge (from depends on to).
     */
    addEdge(fromId: string, toId: string): boolean {
        const from = this.nodes.get(fromId);
        const to = this.nodes.get(toId);
        if (!from || !to) return false;
        if (!from.dependencies.includes(toId)) from.dependencies.push(toId);
        if (!to.dependents.includes(fromId)) to.dependents.push(fromId);
        return true;
    }

    /**
     * Get a node.
     */
    getNode(id: string): GraphNode | null {
        return this.nodes.get(id) ?? null;
    }

    /**
     * Detect circular dependencies.
     */
    detectCycles(): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (id: string, path: string[]): void => {
            if (stack.has(id)) {
                const cycleStart = path.indexOf(id);
                if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
                return;
            }
            if (visited.has(id)) return;
            visited.add(id);
            stack.add(id);
            path.push(id);
            const node = this.nodes.get(id);
            if (node) {
                for (const dep of node.dependencies) dfs(dep, [...path]);
            }
            stack.delete(id);
        };

        for (const id of Array.from(this.nodes.keys())) {
            dfs(id, []);
        }
        return cycles;
    }

    /**
     * Topological sort.
     */
    topologicalSort(): string[] {
        const result: string[] = [];
        const visited = new Set<string>();

        const visit = (id: string): void => {
            if (visited.has(id)) return;
            visited.add(id);
            const node = this.nodes.get(id);
            if (node) {
                for (const dep of node.dependencies) visit(dep);
            }
            result.push(id);
        };

        for (const id of Array.from(this.nodes.keys())) visit(id);
        return result;
    }

    /**
     * Analyze impact of changing a node.
     */
    analyzeImpact(id: string): ImpactAnalysis {
        const node = this.nodes.get(id);
        if (!node) return { directDependents: [], transitiveDependents: [], totalImpacted: 0 };

        const transitive = new Set<string>();
        const queue = [...node.dependents];
        while (queue.length > 0) {
            const depId = queue.shift()!;
            if (transitive.has(depId)) continue;
            transitive.add(depId);
            const dep = this.nodes.get(depId);
            if (dep) queue.push(...dep.dependents);
        }

        return {
            directDependents: [...node.dependents],
            transitiveDependents: Array.from(transitive),
            totalImpacted: transitive.size,
        };
    }

    /**
     * List all nodes.
     */
    list(): Array<{ id: string; label: string; type: string; deps: number; dependents: number }> {
        return Array.from(this.nodes.values()).map((n) => ({
            id: n.id, label: n.label, type: n.type,
            deps: n.dependencies.length, dependents: n.dependents.length,
        }));
    }

    /** Count */
    count(): number { return this.nodes.size; }
}
