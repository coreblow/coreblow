import { randomUUID } from "crypto";

export type NodePendingWorkType = "sync" | "exec" | "ping";
export type NodePendingWorkPriority = "high" | "normal" | "low";

export interface NodePendingWorkItem {
    id: string;
    type: NodePendingWorkType;
    priority: NodePendingWorkPriority;
    expiresAt: number;
    createdAt: number;
}

const workQueues = new Map<string, NodePendingWorkItem[]>();

export function enqueueNodePendingWork(params: {
    nodeId: string;
    type: NodePendingWorkType;
    priority?: NodePendingWorkPriority;
    expiresInMs?: number;
}) {
    const queue = workQueues.get(params.nodeId) || [];
    const item: NodePendingWorkItem = {
        id: randomUUID(),
        type: params.type,
        priority: params.priority || "normal",
        createdAt: Date.now(),
        expiresAt: Date.now() + (params.expiresInMs || 60000)
    };
    queue.push(item);
    workQueues.set(params.nodeId, queue);
    return { item, deduped: false, revision: Date.now() };
}

export function drainNodePendingWork(nodeId: string, opts?: { maxItems?: number, includeDefaultStatus?: boolean }) {
    const queue = workQueues.get(nodeId);
    if (!queue || queue.length === 0) {
        return { items: [], revision: Date.now() };
    }
    
    const now = Date.now();
    const valid = queue.filter(q => q.expiresAt > now);
    
    let items = valid;
    if (opts?.maxItems && opts.maxItems > 0 && opts.maxItems < items.length) {
        items = valid.slice(0, opts.maxItems);
    }
    
    // Remove drained items
    const remaining = valid.filter(v => !items.includes(v));
    if (remaining.length > 0) {
        workQueues.set(nodeId, remaining);
    } else {
        workQueues.delete(nodeId);
    }

    return { items, revision: Date.now() };
}
