import type { CoreBlowConfig } from "../config/config.js";
import { normalizeMessageChannel } from "../utils/message-channel.js";
import {
  doesApprovalRequestMatchChannelAccount,
  resolvePersistedApprovalRequestSessionEntry,
} from "./approval-request-account-binding.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import { resolveSessionDeliveryTarget } from "./outbound/targets.js";
import type { PluginApprovalRequest } from "./plugin-approvals.js";

export type ExecApprovalSessionTarget = {
  channel?: string;
  to: string;
  accountId?: string;
  threadId?: string | number;
};

export type ApprovalRequestSessionConversation = {
  channel: string;
  kind: "group" | "channel";
  id: string;
  rawId: string;
  threadId?: string;
  baseSessionKey: string;
  baseConversationId: string;
  parentConversationCandidates: string[];
};

type ApprovalRequestLike = ExecApprovalRequest | PluginApprovalRequest;

type ApprovalRequestOriginTargetResolver<TTarget> = {
  cfg: CoreBlowConfig;
  request: ApprovalRequestLike;
  channel: string;
  accountId?: string | null;
  resolveTurnSourceTarget: (request: ApprovalRequestLike) => TTarget | null;
  resolveSessionTarget: (sessionTarget: ExecApprovalSessionTarget) => TTarget | null;
  targetsMatch: (a: TTarget, b: TTarget) => boolean;
  resolveFallbackTarget?: (request: ApprovalRequestLike) => TTarget | null;
};

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalThreadValue(value?: string | number | null): string | number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalChannel(value?: string | null): string | undefined {
  return normalizeMessageChannel(value);
}

function isExecApprovalRequest(request: ApprovalRequestLike): request is ExecApprovalRequest {
  return "command" in request.request;
}

function toExecLikeApprovalRequest(request: ApprovalRequestLike): ExecApprovalRequest {
  if (isExecApprovalRequest(request)) {
    return request;
  }
  return {
    id: request.id,
    request: {
      command: request.request.title,
      sessionKey: request.request.sessionKey ?? undefined,
      turnSourceChannel: request.request.turnSourceChannel ?? undefined,
      turnSourceTo: request.request.turnSourceTo ?? undefined,
      turnSourceAccountId: request.request.turnSourceAccountId ?? undefined,
      turnSourceThreadId: request.request.turnSourceThreadId ?? undefined,
    },
    createdAtMs: request.createdAtMs,
    expiresAtMs: request.expiresAtMs,
  };
}

function parseSessionConversationRef(
  sessionKey: string,
  bundledFallback?: boolean,
): ApprovalRequestSessionConversation | null {
  const trimmed = sessionKey.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":");
  const scopedParts =
    parts[0]?.toLowerCase() === "agent" && parts.length >= 5 ? parts.slice(2) : parts;
  const channel = normalizeOptionalChannel(scopedParts[0]);
  const kind = scopedParts[1]?.trim().toLowerCase();
  if (!channel || (kind !== "group" && kind !== "channel")) {
    return null;
  }
  const rawId = scopedParts.slice(2).join(":").trim();
  if (!rawId) {
    return null;
  }
  const threadMarker = rawId.toLowerCase().lastIndexOf(":thread:");
  const topicMarker = rawId.toLowerCase().lastIndexOf(":topic:");
  const markerIndex = Math.max(threadMarker, topicMarker);
  const markerLength =
    markerIndex === threadMarker && threadMarker >= topicMarker ? ":thread:".length : ":topic:".length;
  const id = markerIndex > 0 ? rawId.slice(0, markerIndex).trim() : rawId;
  const threadId = markerIndex > 0 ? rawId.slice(markerIndex + markerLength).trim() : undefined;
  if (!id) {
    return null;
  }
  const prefix =
    parts[0]?.toLowerCase() === "agent" && parts.length >= 5
      ? `${parts[0]}:${parts[1]}:${scopedParts[0]}:${scopedParts[1]}`
      : `${scopedParts[0]}:${scopedParts[1]}`;
  const baseSessionKey = `${prefix}:${id}`;
  return {
    channel,
    kind,
    id,
    rawId,
    threadId: threadId || undefined,
    baseSessionKey,
    baseConversationId: id,
    parentConversationCandidates: threadId || bundledFallback ? [id] : [],
  };
}

export function resolveApprovalRequestSessionConversation(params: {
  request: ApprovalRequestLike;
  channel?: string | null;
  bundledFallback?: boolean;
}): ApprovalRequestSessionConversation | null {
  const sessionKey = normalizeOptionalString(params.request.request.sessionKey);
  if (!sessionKey) {
    return null;
  }
  const resolved = parseSessionConversationRef(sessionKey, params.bundledFallback);
  if (!resolved) {
    return null;
  }
  const expectedChannel = normalizeOptionalChannel(params.channel);
  if (expectedChannel && normalizeOptionalChannel(resolved.channel) !== expectedChannel) {
    return null;
  }
  return resolved;
}

export function resolveExecApprovalSessionTarget(params: {
  cfg: CoreBlowConfig;
  request: ExecApprovalRequest;
  turnSourceChannel?: string | null;
  turnSourceTo?: string | null;
  turnSourceAccountId?: string | null;
  turnSourceThreadId?: string | number | null;
}): ExecApprovalSessionTarget | null {
  const sessionKey = normalizeOptionalString(params.request.request.sessionKey);
  if (!sessionKey) {
    return null;
  }
  const persisted = resolvePersistedApprovalRequestSessionEntry({
    cfg: params.cfg,
    request: params.request,
  });
  if (!persisted) {
    return null;
  }

  const target = resolveSessionDeliveryTarget({
    entry: persisted.entry,
    requestedChannel: "last",
    turnSourceChannel: normalizeOptionalString(params.turnSourceChannel),
    turnSourceTo: normalizeOptionalString(params.turnSourceTo),
    turnSourceAccountId: normalizeOptionalString(params.turnSourceAccountId),
    turnSourceThreadId: normalizeOptionalThreadValue(params.turnSourceThreadId),
  });
  if (!target.to) {
    return null;
  }

  return {
    channel: normalizeOptionalString(target.channel),
    to: target.to,
    accountId: normalizeOptionalString(target.accountId),
    threadId: normalizeOptionalThreadValue(target.threadId),
  };
}

export function resolveApprovalRequestSessionTarget(params: {
  cfg: CoreBlowConfig;
  request: ApprovalRequestLike;
}): ExecApprovalSessionTarget | null {
  const execLikeRequest = toExecLikeApprovalRequest(params.request);
  return resolveExecApprovalSessionTarget({
    cfg: params.cfg,
    request: execLikeRequest,
    turnSourceChannel: execLikeRequest.request.turnSourceChannel ?? undefined,
    turnSourceTo: execLikeRequest.request.turnSourceTo ?? undefined,
    turnSourceAccountId: execLikeRequest.request.turnSourceAccountId ?? undefined,
    turnSourceThreadId: execLikeRequest.request.turnSourceThreadId ?? undefined,
  });
}

function resolveApprovalRequestStoredSessionTarget(params: {
  cfg: CoreBlowConfig;
  request: ApprovalRequestLike;
}): ExecApprovalSessionTarget | null {
  const execLikeRequest = toExecLikeApprovalRequest(params.request);
  return resolveExecApprovalSessionTarget({
    cfg: params.cfg,
    request: execLikeRequest,
  });
}

export function resolveApprovalRequestOriginTarget<TTarget>(
  params: ApprovalRequestOriginTargetResolver<TTarget>,
): TTarget | null {
  if (
    !doesApprovalRequestMatchChannelAccount({
      cfg: params.cfg,
      request: params.request,
      channel: params.channel,
      accountId: params.accountId,
    })
  ) {
    return null;
  }

  const turnSourceTarget = params.resolveTurnSourceTarget(params.request);
  const expectedChannel = normalizeOptionalChannel(params.channel);
  const sessionTargetBinding = resolveApprovalRequestStoredSessionTarget({
    cfg: params.cfg,
    request: params.request,
  });
  const sessionTarget =
    sessionTargetBinding &&
    normalizeOptionalChannel(sessionTargetBinding.channel) === expectedChannel
      ? params.resolveSessionTarget(sessionTargetBinding)
      : null;

  if (turnSourceTarget && sessionTarget && !params.targetsMatch(turnSourceTarget, sessionTarget)) {
    return null;
  }

  return turnSourceTarget ?? sessionTarget ?? params.resolveFallbackTarget?.(params.request) ?? null;
}

// ---------------------------------------------------------------------------
// ExecApprovalSessionTargetService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class ExecApprovalSessionTargetService {
  resolveApprovalRequestSessionConversation(
    ...args: Parameters<typeof resolveApprovalRequestSessionConversation>
  ) {
    return resolveApprovalRequestSessionConversation(...args);
  }

  resolveExecApprovalSessionTarget(params: Parameters<typeof resolveExecApprovalSessionTarget>[0]) {
    return resolveExecApprovalSessionTarget(params);
  }

  resolveApprovalRequestSessionTarget(
    ...args: Parameters<typeof resolveApprovalRequestSessionTarget>
  ) {
    return resolveApprovalRequestSessionTarget(...args);
  }

  resolveApprovalRequestOriginTarget<TTarget>(
    ...args: Parameters<typeof resolveApprovalRequestOriginTarget<TTarget>>
  ) {
    return resolveApprovalRequestOriginTarget<TTarget>(...args);
  }
}


const { getInstance: getExecApprovalSessionTargetService, __testing: __testing_execApprovalSessionTarget } =
  createStandaloneSingleton({ create: () => new ExecApprovalSessionTargetService(), defaultDeps: {} });

export { getExecApprovalSessionTargetService, __testing_execApprovalSessionTarget };
