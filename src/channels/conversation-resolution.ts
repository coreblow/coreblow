import type { CoreBlowConfig } from "../config/config.js";
import { resolveConversationIdFromTargets } from "../infra/outbound/conversation-id.js";
import { getActivePluginChannelRegistry } from "../plugins/runtime.js";
import { parseExplicitTargetForChannel } from "./plugins/target-parsing.js";
import type { ChannelCommandConversationContext, ChannelPlugin } from "./plugins/types.js";
import { normalizeAnyChannelId, normalizeChannelId } from "./registry.js";

export type ConversationResolutionSource =
  | "command-provider"
  | "focused-binding"
  | "command-fallback"
  | "inbound-provider"
  | "inbound-bundled-artifact"
  | "inbound-bundled-plugin"
  | "inbound-fallback";

export type ConversationResolution = {
  canonical: {
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
  };
  threadId?: string;
  placementHint?: "current" | "child";
  source: ConversationResolutionSource;
};

export type ResolveCommandConversationResolutionInput = {
  cfg: CoreBlowConfig;
  channel?: string | null;
  accountId?: string | null;
  chatType?: string | null;
  threadId?: string | number | null;
  threadParentId?: string | null;
  senderId?: string | null;
  sessionKey?: string | null;
  parentSessionKey?: string | null;
  originatingTo?: string | null;
  commandTo?: string | null;
  fallbackTo?: string | null;
  from?: string | null;
  nativeChannelId?: string | null;
  includePlacementHint?: boolean;
};

export type ResolveInboundConversationResolutionInput = {
  cfg: CoreBlowConfig;
  channel?: string | null;
  accountId?: string | null;
  to?: string | null;
  threadId?: string | number | null;
  conversationId?: string | null;
  groupId?: string | null;
  from?: string | null;
  isGroup?: boolean;
};

type ConversationRef = {
  conversationId?: string;
  parentConversationId?: string;
} | null;

type InboundConversationResolver = (params: {
  from?: string;
  to?: string;
  conversationId?: string;
  threadId?: string;
  isGroup: boolean;
}) => ConversationRef;

const CANONICAL_TARGET_PREFIXES = ["user:", "spaces/"] as const;

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function normalizeOptionalLowercaseString(value: unknown): string | undefined {
  return normalizeOptionalString(value)?.toLowerCase();
}

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return normalizeOptionalLowercaseString(value) ?? "";
}

function stringifyRouteThreadId(value: string | number | null | undefined): string | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.trunc(value)) : undefined;
  }
  return normalizeOptionalString(value);
}

function normalizeConversationTargetRef(ref: {
  conversationId: string;
  parentConversationId?: string;
}): { conversationId: string; parentConversationId?: string } {
  const conversationId = normalizeOptionalString(ref.conversationId);
  if (!conversationId) {
    throw new Error("conversationId is required");
  }
  const parentConversationId = normalizeOptionalString(ref.parentConversationId);
  return {
    conversationId,
    ...(parentConversationId ? { parentConversationId } : {}),
  };
}

function resolveChannelId(raw?: string | null): string | null {
  const normalizedRaw = normalizeOptionalString(raw);
  if (!normalizedRaw) {
    return null;
  }
  return (
    normalizeAnyChannelId(normalizedRaw) ??
    normalizeChannelId(normalizedRaw) ??
    normalizeOptionalLowercaseString(normalizedRaw) ??
    null
  );
}

function getActiveRegistryChannelPlugin(rawChannel: string): ChannelPlugin | undefined {
  const normalized = normalizeAnyChannelId(rawChannel) ?? normalizeOptionalString(rawChannel);
  if (!normalized) {
    return undefined;
  }
  return getActivePluginChannelRegistry()?.channels.find((entry) => entry.plugin.id === normalized)
    ?.plugin;
}

function shouldDefaultParentConversationToSelf(plugin?: ChannelPlugin): boolean {
  return (plugin?.bindings as { selfParentConversationByDefault?: unknown } | undefined)
    ?.selfParentConversationByDefault === true;
}

function normalizeResolutionTarget(params: {
  channel: string;
  accountId: string;
  conversation: ConversationRef | undefined;
  source: ConversationResolutionSource;
  threadId?: string;
  plugin?: ChannelPlugin;
  includePlacementHint?: boolean;
}): ConversationResolution | null {
  const conversationId = normalizeOptionalString(params.conversation?.conversationId);
  if (!conversationId) {
    return null;
  }
  const parentConversationId = normalizeOptionalString(params.conversation?.parentConversationId);
  const defaultParentToSelf =
    shouldDefaultParentConversationToSelf(params.plugin) &&
    !params.threadId &&
    !parentConversationId;
  const normalized = normalizeConversationTargetRef({
    conversationId,
    parentConversationId: defaultParentToSelf ? conversationId : parentConversationId,
  });
  const placementHint =
    params.includePlacementHint === false
      ? undefined
      : resolveChannelDefaultBindingPlacement(params.channel);
  return {
    canonical: {
      channel: params.channel,
      accountId: params.accountId,
      conversationId: normalized.conversationId,
      ...(normalized.parentConversationId
        ? { parentConversationId: normalized.parentConversationId }
        : {}),
    },
    ...(params.threadId ? { threadId: params.threadId } : {}),
    ...(placementHint ? { placementHint } : {}),
    source: params.source,
  };
}

function resolveBindingAccountId(params: {
  rawAccountId?: string | null;
  plugin?: ChannelPlugin;
  cfg: CoreBlowConfig;
}): string {
  return (
    normalizeOptionalString(params.rawAccountId) ||
    normalizeOptionalString(params.plugin?.config.defaultAccountId?.(params.cfg)) ||
    "default"
  );
}

function resolveChannelTargetId(params: {
  channel: string;
  target?: string | null;
}): string | undefined {
  const target = normalizeOptionalString(params.target);
  if (!target) {
    return undefined;
  }

  const lower = normalizeLowercaseStringOrEmpty(target);
  const channelPrefix = `${params.channel}:`;
  if (lower.startsWith(channelPrefix)) {
    return resolveChannelTargetId({
      channel: params.channel,
      target: target.slice(channelPrefix.length),
    });
  }
  if (CANONICAL_TARGET_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return target;
  }

  const explicitConversationId = resolveConversationIdFromTargets({
    targets: [target],
  });
  if (explicitConversationId) {
    return explicitConversationId;
  }

  const parsed = parseExplicitTargetForChannel(params.channel, target);
  const parsedTarget = normalizeOptionalString(parsed?.to);
  if (parsedTarget) {
    return (
      resolveConversationIdFromTargets({
        targets: [parsedTarget],
      }) ?? parsedTarget
    );
  }

  return target;
}

function buildThreadingContext(params: {
  fallbackTo?: string;
  originatingTo?: string;
  threadId?: string;
  from?: string;
  chatType?: string;
  nativeChannelId?: string;
}) {
  const to =
    normalizeOptionalString(params.originatingTo) ?? normalizeOptionalString(params.fallbackTo);
  return {
    ...(to ? { To: to } : {}),
    ...(params.from ? { From: params.from } : {}),
    ...(params.chatType ? { ChatType: params.chatType } : {}),
    ...(params.threadId ? { MessageThreadId: params.threadId } : {}),
    ...(params.nativeChannelId ? { NativeChannelId: params.nativeChannelId } : {}),
  };
}

export function resolveChannelDefaultBindingPlacement(
  rawChannel?: string | null,
): "current" | "child" | undefined {
  const channel = resolveChannelId(rawChannel);
  if (!channel) {
    return undefined;
  }
  const plugin = getActiveRegistryChannelPlugin(channel);
  const placement = (plugin?.conversationBindings as { defaultTopLevelPlacement?: unknown } | undefined)
    ?.defaultTopLevelPlacement;
  return placement === "current" || placement === "child" ? placement : undefined;
}

export function resolveCommandConversationResolution(
  params: ResolveCommandConversationResolutionInput,
): ConversationResolution | null {
  const channel = resolveChannelId(params.channel);
  if (!channel) {
    return null;
  }
  const plugin = getActiveRegistryChannelPlugin(channel);
  const accountId = resolveBindingAccountId({
    rawAccountId: params.accountId,
    plugin,
    cfg: params.cfg,
  });
  const threadId = stringifyRouteThreadId(params.threadId);

  const commandParams: ChannelCommandConversationContext = {
    accountId,
    threadId,
    threadParentId: normalizeOptionalString(params.threadParentId),
    senderId: normalizeOptionalString(params.senderId),
    sessionKey: normalizeOptionalString(params.sessionKey),
    parentSessionKey: normalizeOptionalString(params.parentSessionKey),
    originatingTo: params.originatingTo ?? undefined,
    commandTo: params.commandTo ?? undefined,
    fallbackTo: params.fallbackTo ?? undefined,
  };

  const resolvedByProvider = plugin?.bindings?.resolveCommandConversation?.(commandParams);
  const providerResolution = normalizeResolutionTarget({
    channel,
    accountId,
    conversation: resolvedByProvider,
    source: "command-provider",
    threadId,
    plugin,
    includePlacementHint: params.includePlacementHint,
  });
  if (providerResolution) {
    return providerResolution;
  }

  const focusedBinding = plugin?.threading?.resolveFocusedBinding?.({
    cfg: params.cfg,
    accountId,
    context: buildThreadingContext({
      fallbackTo: params.fallbackTo ?? undefined,
      originatingTo: params.originatingTo ?? undefined,
      threadId,
      from: normalizeOptionalString(params.from),
      chatType: normalizeOptionalString(params.chatType),
      nativeChannelId: normalizeOptionalString(params.nativeChannelId),
    }),
  });
  const focusedResolution = normalizeResolutionTarget({
    channel,
    accountId,
    conversation: focusedBinding,
    source: "focused-binding",
    threadId,
    plugin,
    includePlacementHint: params.includePlacementHint,
  });
  if (focusedResolution) {
    return focusedResolution;
  }

  const baseConversationId =
    resolveChannelTargetId({ channel, target: params.originatingTo }) ??
    resolveChannelTargetId({ channel, target: params.commandTo }) ??
    resolveChannelTargetId({ channel, target: params.fallbackTo });
  const parentConversationId =
    resolveChannelTargetId({ channel, target: params.threadParentId }) ??
    (threadId && baseConversationId && baseConversationId !== threadId
      ? baseConversationId
      : undefined);
  const conversationId = threadId || baseConversationId;
  if (!conversationId) {
    return null;
  }
  return normalizeResolutionTarget({
    channel,
    accountId,
    conversation: {
      conversationId,
      parentConversationId,
    },
    source: "command-fallback",
    threadId,
    plugin,
    includePlacementHint: params.includePlacementHint,
  });
}

export function resolveInboundConversationResolution(
  params: ResolveInboundConversationResolutionInput,
): ConversationResolution | null {
  const channel = resolveChannelId(params.channel);
  if (!channel) {
    return null;
  }
  const plugin = getActiveRegistryChannelPlugin(channel);
  const accountId = resolveBindingAccountId({
    rawAccountId: params.accountId,
    plugin,
    cfg: params.cfg,
  });
  const threadId = stringifyRouteThreadId(params.threadId);
  const resolverParams = {
    from: normalizeOptionalString(params.from),
    to: normalizeOptionalString(params.to),
    conversationId:
      normalizeOptionalString(params.conversationId) ??
      normalizeOptionalString(params.groupId) ??
      normalizeOptionalString(params.to),
    threadId,
    isGroup: params.isGroup ?? true,
  };

  const inboundResolver = (plugin?.messaging as { resolveInboundConversation?: InboundConversationResolver } | undefined)
    ?.resolveInboundConversation;
  const providerConversation = inboundResolver?.(resolverParams);
  const providerResolution = normalizeResolutionTarget({
    channel,
    accountId,
    conversation: providerConversation,
    source: "inbound-provider",
    threadId,
    plugin,
  });
  if (providerResolution || providerConversation === null) {
    return providerResolution;
  }

  const parentConversationId =
    resolveChannelTargetId({ channel, target: params.to }) ??
    resolveChannelTargetId({ channel, target: params.conversationId }) ??
    resolveChannelTargetId({ channel, target: params.groupId });
  const genericConversationId =
    threadId ??
    resolveChannelTargetId({ channel, target: params.conversationId }) ??
    resolveChannelTargetId({ channel, target: params.groupId }) ??
    parentConversationId;
  if (!genericConversationId) {
    return null;
  }
  return normalizeResolutionTarget({
    channel,
    accountId,
    conversation: {
      conversationId: genericConversationId,
      parentConversationId: threadId != null ? parentConversationId : undefined,
    },
    source: "inbound-fallback",
    threadId,
    plugin,
  });
}
