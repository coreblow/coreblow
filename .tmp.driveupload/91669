/**
 * src/shared/node-resolve.ts
 * High-level node resolution.
 * Ported from CoreBlow shared/node-resolve.ts.
 */

import { type NodeMatchCandidate, resolveNodeIdFromCandidates } from "./node-match.js";

export type ResolveNodeFromListOptions<TNode extends NodeMatchCandidate> = {
    allowDefault?: boolean;
    pickDefaultNode?: (nodes: TNode[]) => TNode | null;
};

export function resolveNodeIdFromNodeList<TNode extends NodeMatchCandidate>(
    nodes: TNode[],
    query?: string,
    options: ResolveNodeFromListOptions<TNode> = {},
): string {
    const q = String(query ?? "").trim();
    if (!q) {
        if (options.allowDefault === true && options.pickDefaultNode) {
            const picked = options.pickDefaultNode(nodes);
            if (picked) return picked.nodeId;
        }
        throw new Error("node required");
    }
    return resolveNodeIdFromCandidates(nodes, q);
}

export function resolveNodeFromNodeList<TNode extends NodeMatchCandidate>(
    nodes: TNode[],
    query?: string,
    options: ResolveNodeFromListOptions<TNode> = {},
): TNode {
    const nodeId = resolveNodeIdFromNodeList(nodes, query, options);
    return nodes.find((node) => node.nodeId === nodeId) ?? ({ nodeId } as TNode);
}
