import {
    ADMIN_SCOPE,
    APPROVALS_SCOPE,
    PAIRING_SCOPE,
    READ_SCOPE,
    WRITE_SCOPE,
} from "./method-scopes.js";
import type { ConnectParams } from "./protocol/index.js";

const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
    "exec.approval.requested": [APPROVALS_SCOPE],
    "exec.approval.resolved": [APPROVALS_SCOPE],
    "plugin.approval.requested": [APPROVALS_SCOPE],
    "plugin.approval.resolved": [APPROVALS_SCOPE],
    "device.pair.requested": [PAIRING_SCOPE],
    "device.pair.resolved": [PAIRING_SCOPE],
    "node.pair.requested": [PAIRING_SCOPE],
    "node.pair.resolved": [PAIRING_SCOPE],
    "sessions.changed": [READ_SCOPE],
    "session.message": [READ_SCOPE],
    "session.tool": [READ_SCOPE],
};

export interface ActiveClientConnection {
    connId: string;
    connect: ConnectParams;
    sendEvent: (eventRaw: string, dropIfSlow?: boolean) => void;
}

export type GatewayBroadcastStateVersion = {
    presence?: number;
    health?: number;
};

export type GatewayBroadcastOpts = {
    dropIfSlow?: boolean;
    stateVersion?: GatewayBroadcastStateVersion;
};

export type GatewayBroadcastFn = (
    event: string,
    payload: unknown,
    opts?: GatewayBroadcastOpts,
) => void;

export type GatewayBroadcastToConnIdsFn = (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: GatewayBroadcastOpts,
) => void;

function hasEventScope(client: ActiveClientConnection, event: string): boolean {
    const required = EVENT_SCOPE_GUARDS[event];
    if (!required) {
        return true;
    }
    const role = client.connect.role ?? "operator";
    if (role !== "operator") {
        return false;
    }
    const scopes = Array.isArray(client.connect.scopes) ? client.connect.scopes : [];
    if (scopes.includes(ADMIN_SCOPE)) {
        return true;
    }
    if (required.includes(READ_SCOPE)) {
        return scopes.includes(READ_SCOPE) || scopes.includes(WRITE_SCOPE);
    }
    return required.some((scope) => scopes.includes(scope));
}

export function createGatewayBroadcaster(params: { getClients: () => Iterable<ActiveClientConnection> }) {
    let seq = 0;

    const broadcastInternal = (
        event: string,
        payload: unknown,
        opts?: GatewayBroadcastOpts,
        targetConnIds?: ReadonlySet<string>,
    ) => {
        const isTargeted = Boolean(targetConnIds);
        const eventSeq = isTargeted ? undefined : ++seq;
        const frame = JSON.stringify({
            type: "event",
            event,
            payload,
            seq: eventSeq,
            stateVersion: opts?.stateVersion,
        });

        for (const c of params.getClients()) {
            if (targetConnIds && !targetConnIds.has(c.connId)) {
                continue;
            }
            if (!hasEventScope(c, event)) {
                continue;
            }
            c.sendEvent(frame, opts?.dropIfSlow);
        }
    };

    const broadcast: GatewayBroadcastFn = (event, payload, opts) =>
        broadcastInternal(event, payload, opts);

    const broadcastToConnIds: GatewayBroadcastToConnIdsFn = (event, payload, connIds, opts) => {
        if (connIds.size === 0) {
            return;
        }
        broadcastInternal(event, payload, opts, connIds);
    };

    return { broadcast, broadcastToConnIds };
}
