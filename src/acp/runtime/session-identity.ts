import type {
  SessionAcpIdentity,
  SessionAcpIdentitySource,
  SessionAcpMeta,
} from "../../config/sessions/types.js";
import type { AcpRuntimeHandle, AcpRuntimeStatus } from "./types.js";

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeIdentityState(value: unknown): SessionAcpIdentity["state"] | undefined {
  if (value !== "pending" && value !== "resolved") {
    return undefined;
  }
  return value;
}

function normalizeIdentitySource(value: unknown): SessionAcpIdentitySource | undefined {
  if (value !== "ensure" && value !== "status" && value !== "event") {
    return undefined;
  }
  return value;
}

function normalizeIdentity(
  identity: SessionAcpIdentity | undefined,
): SessionAcpIdentity | undefined {
  if (!identity) {
    return undefined;
  }
  const state = normalizeIdentityState(identity.state);
  const source = normalizeIdentitySource(identity.source);
  const acpRecordId = normalizeText(identity.acpRecordId);
  const acpSessionId = normalizeText(identity.acpSessionId);
  const agentSessionId = normalizeText(identity.agentSessionId);
  const lastUpdatedAt =
    typeof identity.lastUpdatedAt === "number" && Number.isFinite(identity.lastUpdatedAt)
      ? identity.lastUpdatedAt
      : undefined;
  const hasAnyId = Boolean(acpRecordId || acpSessionId || agentSessionId);
  if (!state && !source && !hasAnyId && lastUpdatedAt === undefined) {
    return undefined;
  }
  const resolved = Boolean(acpSessionId || agentSessionId);
  const normalizedState = state ?? (resolved ? "resolved" : "pending");
  return {
    state: normalizedState,
    ...(acpRecordId ? { acpRecordId } : {}),
    ...(acpSessionId ? { acpSessionId } : {}),
    ...(agentSessionId ? { agentSessionId } : {}),
    source: source ?? "status",
    lastUpdatedAt: lastUpdatedAt ?? Date.now(),
  };
}

export function resolveSessionIdentityFromMeta(
  meta: SessionAcpMeta | undefined,
): SessionAcpIdentity | undefined {
  if (!meta) {
    return undefined;
  }
  return normalizeIdentity(meta.identity);
}

export function identityHasStableSessionId(identity: SessionAcpIdentity | undefined): boolean {
  return Boolean(identity?.acpSessionId || identity?.agentSessionId);
}

export function resolveRuntimeResumeSessionId(
  identity: SessionAcpIdentity | undefined,
): string | undefined {
  if (!identity) {
    return undefined;
  }
  return normalizeText(identity.acpSessionId) ?? normalizeText(identity.agentSessionId);
}

export function isSessionIdentityPending(identity: SessionAcpIdentity | undefined): boolean {
  if (!identity) {
    return true;
  }
  return identity.state === "pending";
}

export function identityEquals(
  left: SessionAcpIdentity | undefined,
  right: SessionAcpIdentity | undefined,
): boolean {
  const a = normalizeIdentity(left);
  const b = normalizeIdentity(right);
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.state === b.state &&
    a.acpRecordId === b.acpRecordId &&
    a.acpSessionId === b.acpSessionId &&
    a.agentSessionId === b.agentSessionId &&
    a.source === b.source
  );
}

export function mergeSessionIdentity(params: {
  current: SessionAcpIdentity | undefined;
  incoming: SessionAcpIdentity | undefined;
  now: number;
}): SessionAcpIdentity | undefined {
  const current = normalizeIdentity(params.current);
  const incoming = normalizeIdentity(params.incoming);
  if (!current) {
    if (!incoming) {
      return undefined;
    }
    return { ...incoming, lastUpdatedAt: params.now };
  }
  if (!incoming) {
    return current;
  }

  const currentResolved = current.state === "resolved";
  const incomingResolved = incoming.state === "resolved";
  const allowIncomingValue = !currentResolved || incomingResolved;
  const nextRecordId =
    allowIncomingValue && incoming.acpRecordId ? incoming.acpRecordId : current.acpRecordId;
  const nextAcpSessionId =
    allowIncomingValue && incoming.acpSessionId ? incoming.acpSessionId : current.acpSessionId;
  const nextAgentSessionId =
    allowIncomingValue && incoming.agentSessionId
      ? incoming.agentSessionId
      : current.agentSessionId;

  const nextResolved = Boolean(nextAcpSessionId || nextAgentSessionId);
  const nextState: SessionAcpIdentity["state"] = nextResolved
    ? "resolved"
    : currentResolved
      ? "resolved"
      : incoming.state;
  const nextSource = allowIncomingValue ? incoming.source : current.source;
  const next: SessionAcpIdentity = {
    state: nextState,
    ...(nextRecordId ? { acpRecordId: nextRecordId } : {}),
    ...(nextAcpSessionId ? { acpSessionId: nextAcpSessionId } : {}),
    ...(nextAgentSessionId ? { agentSessionId: nextAgentSessionId } : {}),
    source: nextSource,
    lastUpdatedAt: params.now,
  };
  return next;
}

export function createIdentityFromEnsure(params: {
  handle: AcpRuntimeHandle;
  now: number;
}): SessionAcpIdentity | undefined {
  const acpRecordId = normalizeText((params.handle as { acpRecordId?: unknown }).acpRecordId);
  const acpSessionId = normalizeText(params.handle.backendSessionId);
  const agentSessionId = normalizeText(params.handle.agentSessionId);
  if (!acpRecordId && !acpSessionId && !agentSessionId) {
    return undefined;
  }
  return {
    state: "pending",
    ...(acpRecordId ? { acpRecordId } : {}),
    ...(acpSessionId ? { acpSessionId } : {}),
    ...(agentSessionId ? { agentSessionId } : {}),
    source: "ensure",
    lastUpdatedAt: params.now,
  };
}

export function createIdentityFromStatus(params: {
  status: AcpRuntimeStatus | undefined;
  now: number;
}): SessionAcpIdentity | undefined {
  if (!params.status) {
    return undefined;
  }
  const details = params.status.details;
  const acpRecordId =
    normalizeText((params.status as { acpRecordId?: unknown }).acpRecordId) ??
    normalizeText(details?.acpRecordId);
  const acpSessionId =
    normalizeText(params.status.backendSessionId) ??
    normalizeText(details?.backendSessionId) ??
    normalizeText(details?.acpSessionId);
  const agentSessionId =
    normalizeText(params.status.agentSessionId) ?? normalizeText(details?.agentSessionId);
  if (!acpRecordId && !acpSessionId && !agentSessionId) {
    return undefined;
  }
  const resolved = Boolean(acpSessionId || agentSessionId);
  return {
    state: resolved ? "resolved" : "pending",
    ...(acpRecordId ? { acpRecordId } : {}),
    ...(acpSessionId ? { acpSessionId } : {}),
    ...(agentSessionId ? { agentSessionId } : {}),
    source: "status",
    lastUpdatedAt: params.now,
  };
}

export function resolveRuntimeHandleIdentifiersFromIdentity(
  identity: SessionAcpIdentity | undefined,
): { backendSessionId?: string; agentSessionId?: string } {
  if (!identity) {
    return {};
  }
  return {
    ...(identity.acpSessionId ? { backendSessionId: identity.acpSessionId } : {}),
    ...(identity.agentSessionId ? { agentSessionId: identity.agentSessionId } : {}),
  };
}
