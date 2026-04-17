/**
 * src/shared/node-list-parse.ts
 * Type definitions and parsing for node lists.
 * Ported from CoreBlow shared/node-list-types.ts and shared/node-list-parse.ts.
 */

// ── Types ──

export type NodeListNode = {
    nodeId: string;
    displayName?: string;
    platform?: string;
    version?: string;
    coreVersion?: string;
    uiVersion?: string;
    remoteIp?: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    pathEnv?: string;
    caps?: string[];
    commands?: string[];
    permissions?: Record<string, boolean>;
    paired?: boolean;
    connected?: boolean;
    connectedAtMs?: number;
};

export type PendingRequest = {
    requestId: string;
    nodeId: string;
    displayName?: string;
    platform?: string;
    version?: string;
    coreVersion?: string;
    uiVersion?: string;
    remoteIp?: string;
    isRepair?: boolean;
    ts: number;
};

export type PairedNode = {
    nodeId: string;
    token?: string;
    displayName?: string;
    platform?: string;
    version?: string;
    coreVersion?: string;
    uiVersion?: string;
    remoteIp?: string;
    permissions?: Record<string, boolean>;
    createdAtMs?: number;
    approvedAtMs?: number;
    lastConnectedAtMs?: number;
};

export type PairingList = {
    pending: PendingRequest[];
    paired: PairedNode[];
};

// ── Parsing ──

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function parsePairingList(value: unknown): PairingList {
    const obj = asRecord(value);
    const pending = Array.isArray(obj.pending) ? (obj.pending as PendingRequest[]) : [];
    const paired = Array.isArray(obj.paired) ? (obj.paired as PairedNode[]) : [];
    return { pending, paired };
}

export function parseNodeList(value: unknown): NodeListNode[] {
    const obj = asRecord(value);
    return Array.isArray(obj.nodes) ? (obj.nodes as NodeListNode[]) : [];
}

export function formatNodeListEntry(entry: NodeListNode): string {
    return entry.displayName || entry.remoteIp || entry.nodeId;
}
