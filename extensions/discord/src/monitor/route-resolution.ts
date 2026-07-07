import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import {
  deriveLastRoutePolicy,
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey,
  resolveAgentRoute,
  resolveAgentIdFromSessionKey,
  type ResolvedAgentRoute,
  type RoutePeer,
} from "coreblow/plugin-sdk/routing";

export function buildDiscordRoutePeer(params: {
  isDirectMessage: boolean;
  isGroupDm: boolean;
  directUserId?: string | null;
  conversationId: string;
}): RoutePeer {
  return {
    kind: params.isDirectMessage ? "direct" : params.isGroupDm ? "group" : "channel",
    id: params.isDirectMessage
      ? params.directUserId?.trim() || params.conversationId
      : params.conversationId,
  };
}

export function resolveDiscordConversationRoute(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  guildId?: string | null;
  memberRoleIds?: string[];
  peer: RoutePeer;
  parentConversationId?: string | null;
}): ResolvedAgentRoute {
  return resolveAgentRoute({
    cfg: params.cfg,
    channel: "discord",
    accountId: params.accountId,
    guildId: params.guildId ?? undefined,
    memberRoleIds: params.memberRoleIds,
    peer: params.peer,
    parentPeer: params.parentConversationId
      ? { kind: "channel", id: params.parentConversationId }
      : undefined,
  });
}

export function resolveDiscordBoundConversationRoute(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  guildId?: string | null;
  memberRoleIds?: string[];
  isDirectMessage: boolean;
  isGroupDm: boolean;
  directUserId?: string | null;
  conversationId: string;
  parentConversationId?: string | null;
  boundSessionKey?: string | null;
  configuredRoute?: { route: ResolvedAgentRoute } | null;
  matchedBy?: ResolvedAgentRoute["matchedBy"];
}): ResolvedAgentRoute {
  const route = resolveDiscordConversationRoute({
    cfg: params.cfg,
    accountId: params.accountId,
    guildId: params.guildId,
    memberRoleIds: params.memberRoleIds,
    peer: buildDiscordRoutePeer({
      isDirectMessage: params.isDirectMessage,
      isGroupDm: params.isGroupDm,
      directUserId: params.directUserId,
      conversationId: params.conversationId,
    }),
    parentConversationId: params.parentConversationId,
  });
  return resolveDiscordEffectiveRoute({
    route,
    boundSessionKey: params.boundSessionKey,
    configuredRoute: params.configuredRoute,
    matchedBy: params.matchedBy,
  });
}

export function resolveDiscordEffectiveRoute(params: {
  route: ResolvedAgentRoute;
  boundSessionKey?: string | null;
  configuredRoute?: { route: ResolvedAgentRoute } | null;
  matchedBy?: ResolvedAgentRoute["matchedBy"];
}): ResolvedAgentRoute {
  const boundSessionKey = params.boundSessionKey?.trim();
  if (!boundSessionKey) {
    return params.configuredRoute?.route ?? params.route;
  }
  return {
    ...params.route,
    sessionKey: boundSessionKey,
    agentId: resolveAgentIdFromSessionKey(boundSessionKey),
    lastRoutePolicy: deriveLastRoutePolicy({
      sessionKey: boundSessionKey,
      mainSessionKey: params.route.mainSessionKey,
    }),
    ...(params.matchedBy ? { matchedBy: params.matchedBy } : {}),
  };
}

export function shouldIgnoreStaleDiscordRouteBinding(params: {
  bindingRecord?: import("coreblow/plugin-sdk/conversation-binding-runtime").SessionBindingRecord | null;
  route: ResolvedAgentRoute;
}): boolean {
  const bindingRecord = params.bindingRecord;
  const boundSessionKey = bindingRecord?.targetSessionKey?.trim();
  if (!bindingRecord || !boundSessionKey) {
    return false;
  }
  if (bindingRecord.targetKind === "subagent") {
    return false;
  }
  if (
    isAcpSessionKey(bindingRecord.targetSessionKey) ||
    isSubagentSessionKey(bindingRecord.targetSessionKey)
  ) {
    return false;
  }
  const metadata = bindingRecord.metadata;
  if (metadata && typeof metadata === "object") {
    if (
      typeof (metadata as Record<string, unknown>).boundBy === "string" ||
      typeof (metadata as Record<string, unknown>).label === "string" ||
      typeof (metadata as Record<string, unknown>).threadName === "string" ||
      (metadata as Record<string, unknown>).pluginBindingOwner === "plugin"
    ) {
      return false;
    }
  }
  const bound = parseAgentSessionKey(boundSessionKey);
  const routed = parseAgentSessionKey(params.route.sessionKey);
  if (!bound || !routed || bound.rest !== routed.rest) {
    return false;
  }
  return bound.agentId !== params.route.agentId;
}
