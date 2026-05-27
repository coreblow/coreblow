import type { CoreBlowConfig } from "../config/config.js";
import type { NodePairingPairedNode, NodePairingPendingRequest } from "../infra/node-pairing.js";
import {
  normalizeDeclaredNodeCommands,
  resolveNodeCommandAllowlist,
  resolveNodePairingCommandAllowlist,
} from "./node-command-policy.js";
import type { ConnectParams } from "./protocol/index.js";

type NodePairingRequestInput = Omit<
  NodePairingPendingRequest,
  "requestId" | "ts" | "isRepair"
>;
type RequestNodePairingResult = {
  status: "pending";
  request: NodePairingPendingRequest;
  created: boolean;
};

export type NodeConnectPairingReconcileResult = {
  nodeId: string;
  declaredCaps: string[];
  effectiveCaps: string[];
  declaredCommands: string[];
  effectiveCommands: string[];
  declaredPermissions?: Record<string, boolean>;
  effectivePermissions?: Record<string, boolean>;
  pendingPairing?: RequestNodePairingResult;
};

function normalizeApprovalSurfaceList(value: readonly string[] | undefined): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value ?? []) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizePermissionMap(
  value: Record<string, boolean> | undefined,
): Record<string, boolean> | undefined {
  if (!value) {
    return undefined;
  }
  const entries = Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function sameApprovalSurfaceSet(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  const leftSet = new Set(normalizeApprovalSurfaceList(left));
  const rightSet = new Set(normalizeApprovalSurfaceList(right));
  return leftSet.size === rightSet.size && [...leftSet].every((entry) => rightSet.has(entry));
}

function samePermissions(
  left: Record<string, boolean> | undefined,
  right: Record<string, boolean> | undefined,
): boolean {
  const leftEntries = Object.entries(left ?? {}).toSorted(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right ?? {}).toSorted(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value,
    )
  );
}

function intersectApprovalSurfaceList(params: {
  approved: readonly string[] | undefined;
  declared: readonly string[];
}): string[] {
  const approved = new Set(normalizeApprovalSurfaceList(params.approved));
  return normalizeApprovalSurfaceList(params.declared).filter((entry) => approved.has(entry));
}

function intersectPermissionSurface(params: {
  approved: Record<string, boolean> | undefined;
  declared: Record<string, boolean> | undefined;
}): Record<string, boolean> | undefined {
  const entries: Array<[string, boolean]> = [];
  for (const [key, declaredValue] of Object.entries(params.declared ?? {})) {
    const approvedValue = params.approved?.[key];
    if (!declaredValue) {
      entries.push([key, false]);
    } else if (approvedValue !== undefined) {
      entries.push([key, approvedValue]);
    }
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function buildNodePairingRequestInput(params: {
  nodeId: string;
  connectParams: ConnectParams;
  caps: string[];
  commands: string[];
  permissions?: Record<string, boolean>;
  remoteIp?: string;
}): NodePairingRequestInput {
  return {
    nodeId: params.nodeId,
    displayName: params.connectParams.client.displayName,
    platform: params.connectParams.client.platform,
    version: params.connectParams.client.version,
    deviceFamily: params.connectParams.client.deviceFamily,
    modelIdentifier: params.connectParams.client.modelIdentifier,
    caps: params.caps,
    commands: params.commands,
    permissions: params.permissions,
    remoteIp: params.remoteIp,
  };
}

export async function reconcileNodePairingOnConnect(params: {
  cfg: CoreBlowConfig;
  connectParams: ConnectParams;
  pairedNode: NodePairingPairedNode | null;
  reportedClientIp?: string;
  requestPairing: (input: NodePairingRequestInput) => Promise<RequestNodePairingResult>;
}): Promise<NodeConnectPairingReconcileResult> {
  const nodeId = params.connectParams.device?.id ?? params.connectParams.client.id;
  const policyNode = {
    platform: params.connectParams.client.platform,
    deviceFamily: params.connectParams.client.deviceFamily,
  };
  const declaredCommands = normalizeDeclaredNodeCommands({
    declaredCommands: params.connectParams.commands,
    allowlist: resolveNodePairingCommandAllowlist(params.cfg, policyNode),
  });
  const declaredCaps = normalizeApprovalSurfaceList(params.connectParams.caps);
  const declaredPermissions = normalizePermissionMap(params.connectParams.permissions);

  if (!params.pairedNode) {
    const pendingPairing = await params.requestPairing(
      buildNodePairingRequestInput({
        nodeId,
        connectParams: params.connectParams,
        caps: declaredCaps,
        commands: declaredCommands,
        permissions: declaredPermissions,
        remoteIp: params.reportedClientIp,
      }),
    );
    return {
      nodeId,
      declaredCaps,
      effectiveCaps: [],
      declaredCommands,
      effectiveCommands: [],
      declaredPermissions,
      effectivePermissions: undefined,
      pendingPairing,
    };
  }

  const approvedCommands = normalizeDeclaredNodeCommands({
    declaredCommands: params.pairedNode.commands,
    allowlist: resolveNodeCommandAllowlist(params.cfg, policyNode),
  });
  const approvedPermissions = normalizePermissionMap(params.pairedNode.permissions);
  const hasCommandUpgrade = declaredCommands.some((command) => !approvedCommands.includes(command));
  const hasCapabilityChange = !sameApprovalSurfaceSet(params.pairedNode.caps, declaredCaps);
  const hasPermissionChange = !samePermissions(params.pairedNode.permissions, declaredPermissions);
  const effectiveCaps = intersectApprovalSurfaceList({
    approved: params.pairedNode.caps,
    declared: declaredCaps,
  });
  const effectiveCommands = intersectApprovalSurfaceList({
    approved: approvedCommands,
    declared: declaredCommands,
  });
  const effectivePermissions = intersectPermissionSurface({
    approved: approvedPermissions,
    declared: declaredPermissions,
  });

  if (hasCommandUpgrade || hasCapabilityChange || hasPermissionChange) {
    const pendingPairing = await params.requestPairing(
      buildNodePairingRequestInput({
        nodeId,
        connectParams: params.connectParams,
        caps: declaredCaps,
        commands: declaredCommands,
        permissions: declaredPermissions ?? (hasPermissionChange ? {} : undefined),
        remoteIp: params.reportedClientIp,
      }),
    );
    return {
      nodeId,
      declaredCaps,
      effectiveCaps,
      declaredCommands,
      effectiveCommands,
      declaredPermissions,
      effectivePermissions,
      pendingPairing,
    };
  }

  return {
    nodeId,
    declaredCaps,
    effectiveCaps: declaredCaps,
    declaredCommands,
    effectiveCommands: declaredCommands,
    declaredPermissions,
    effectivePermissions: declaredPermissions,
  };
}
