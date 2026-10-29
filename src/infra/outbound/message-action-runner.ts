import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import {
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "../../agents/tools/common.js";
import { parseReplyDirectives } from "../../auto-reply/reply/reply-directives.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import { type SourceReplyDeliveryMode } from "../../channels/message/reply-pipeline.js";
import { getChannelPlugin } from "../../channels/plugins/index.js";
import { dispatchChannelMessageAction } from "../../channels/plugins/message-action-dispatch.js";
import type {
  ChannelId,
  ChannelMessageActionName,
  ChannelThreadingToolContext,
} from "../../channels/plugins/types.js";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  hasInteractiveReplyBlocks,
  hasMessagePresentationBlocks,
  hasReplyPayloadContent,
  normalizeInteractiveReply,
  normalizeMessagePresentation,
} from "../../interactive/payload.js";
import {
  getAgentScopedMediaLocalRoots,
  getAgentScopedMediaLocalRootsForSources,
} from "../../media/local-roots.js";
import { resolveSendableOutboundReplyParts } from "../../plugin-sdk/reply-payload.js";
import { hasPollCreationParams } from "../../poll-params.js";
import { resolvePollMaxSelections } from "../../polls.js";
import { buildChannelAccountBindings } from "../../routing/bindings.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { type GatewayClientMode, type GatewayClientName } from "../../utils/message-channel.js";
import { throwIfAborted } from "./abort.js";
import { resolveOutboundChannelPlugin } from "./channel-resolution.js";
import {
  listConfiguredMessageChannels,
  resolveMessageChannelSelection,
} from "./channel-selection.js";
import type { OutboundSendDeps } from "./deliver.js";
import { normalizeMessageActionInput } from "./message-action-normalization.js";
import {
  hydrateAttachmentParamsForAction,
  normalizeSandboxMediaList,
  normalizeSandboxMediaParams,
  parseButtonsParam,
  parseCardParam,
  parseComponentsParam,
  parseInteractiveParam,
  parseJsonMessageParam,
  readBooleanParam,
  resolveAttachmentMediaPolicy,
} from "./message-action-params.js";
import {
  prepareOutboundMirrorRoute,
  resolveAndApplyOutboundThreadId,
} from "./message-action-threading.js";
import { maybeApplyTtsToMessageActionSendPayload } from "./message-action-tts.js";
import type { MessagePollResult, MessageSendResult } from "./message.js";
import {
  applyCrossContextDecoration,
  buildCrossContextDecoration,
  type CrossContextDecoration,
  enforceCrossContextPolicy,
  shouldApplyCrossContextMarker,
} from "./outbound-policy.js";
import { executePollAction, executeSendAction } from "./outbound-send-service.js";
import { ensureOutboundSessionEntry, resolveOutboundSessionRoute } from "./outbound-session.js";
import { resolveChannelTarget, type ResolvedMessagingTarget } from "./target-resolver.js";
import { extractToolPayload } from "./tool-payload.js";

export type MessageActionRunnerGateway = {
  url?: string;
  token?: string;
  timeoutMs?: number;
  clientName: GatewayClientName;
  clientDisplayName?: string;
  mode: GatewayClientMode;
};

export type RunMessageActionParams = {
  cfg: CoreBlowConfig;
  action: ChannelMessageActionName;
  params: Record<string, unknown>;
  defaultAccountId?: string;
  requesterSenderId?: string | null;
  sessionId?: string;
  toolContext?: ChannelThreadingToolContext;
  gateway?: MessageActionRunnerGateway;
  deps?: OutboundSendDeps;
  sessionKey?: string;
  agentId?: string;
  sandboxRoot?: string;
  dryRun?: boolean;
  sourceReplyDeliveryMode?: SourceReplyDeliveryMode;
  abortSignal?: AbortSignal;
};

export type MessageActionRunResult =
  | {
      kind: "send";
      channel: ChannelId;
      action: "send";
      to: string;
      handledBy: "plugin" | "core" | "internal-source";
      payload: unknown;
      toolResult?: AgentToolResult<unknown>;
      sendResult?: MessageSendResult;
      dryRun: boolean;
    }
  | {
      kind: "broadcast";
      channel: ChannelId;
      action: "broadcast";
      handledBy: "core" | "dry-run";
      payload: {
        results: Array<{
          channel: ChannelId;
          to: string;
          ok: boolean;
          error?: string;
          result?: MessageSendResult;
        }>;
      };
      dryRun: boolean;
    }
  | {
      kind: "poll";
      channel: ChannelId;
      action: "poll";
      to: string;
      handledBy: "plugin" | "core";
      payload: unknown;
      toolResult?: AgentToolResult<unknown>;
      pollResult?: MessagePollResult;
      dryRun: boolean;
    }
  | {
      kind: "action";
      channel: ChannelId;
      action: Exclude<ChannelMessageActionName, "send" | "poll">;
      handledBy: "plugin" | "dry-run";
      payload: unknown;
      toolResult?: AgentToolResult<unknown>;
      dryRun: boolean;
    };

export function getToolResult(
  result: MessageActionRunResult,
): AgentToolResult<unknown> | undefined {
  return "toolResult" in result ? result.toolResult : undefined;
}

function collectActionMediaSourceHints(params: Record<string, unknown>): string[] {
  const sources: string[] = [];
  for (const key of ["media", "mediaUrl", "path", "filePath", "fileUrl"] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      sources.push(value);
    }
  }
  return sources;
}

function applyCrossContextMessageDecoration({
  params,
  message,
  decoration,
  preferComponents,
}: {
  params: Record<string, unknown>;
  message: string;
  decoration: CrossContextDecoration;
  preferComponents: boolean;
}): string {
  const applied = applyCrossContextDecoration({
    message,
    decoration,
    preferComponents,
  });
  params.message = applied.message;
  if (applied.componentsBuilder) {
    params.components = applied.componentsBuilder;
  }
  return applied.message;
}

async function maybeApplyCrossContextMarker(params: {
  cfg: CoreBlowConfig;
  channel: ChannelId;
  action: ChannelMessageActionName;
  target: string;
  toolContext?: ChannelThreadingToolContext;
  accountId?: string | null;
  args: Record<string, unknown>;
  message: string;
  preferComponents: boolean;
}): Promise<string> {
  if (!shouldApplyCrossContextMarker(params.action) || !params.toolContext) {
    return params.message;
  }
  const decoration = await buildCrossContextDecoration({
    cfg: params.cfg,
    channel: params.channel,
    target: params.target,
    toolContext: params.toolContext,
    accountId: params.accountId ?? undefined,
  });
  if (!decoration) {
    return params.message;
  }
  return applyCrossContextMessageDecoration({
    params: params.args,
    message: params.message,
    decoration,
    preferComponents: params.preferComponents,
  });
}

async function resolveChannel(
  cfg: CoreBlowConfig,
  params: Record<string, unknown>,
  toolContext?: { currentChannelProvider?: string },
) {
  const selection = await resolveMessageChannelSelection({
    cfg,
    channel: readStringParam(params, "channel"),
    fallbackChannel: toolContext?.currentChannelProvider,
  });
  if (selection.source === "tool-context-fallback") {
    params.channel = selection.channel;
  }
  return selection.channel;
}

async function resolveActionTarget(params: {
  cfg: CoreBlowConfig;
  channel: ChannelId;
  action: ChannelMessageActionName;
  args: Record<string, unknown>;
  accountId?: string | null;
}): Promise<ResolvedMessagingTarget | undefined> {
  let resolvedTarget: ResolvedMessagingTarget | undefined;
  const toRaw = typeof params.args.to === "string" ? params.args.to.trim() : "";
  if (toRaw) {
    const resolved = await resolveChannelTarget({
      cfg: params.cfg,
      channel: params.channel,
      input: toRaw,
      accountId: params.accountId ?? undefined,
    });
    if (resolved.ok) {
      params.args.to = resolved.target.to;
      resolvedTarget = resolved.target;
    } else {
      throw resolved.error;
    }
  }
  const channelIdRaw =
    typeof params.args.channelId === "string" ? params.args.channelId.trim() : "";
  if (channelIdRaw) {
    const resolved = await resolveChannelTarget({
      cfg: params.cfg,
      channel: params.channel,
      input: channelIdRaw,
      accountId: params.accountId ?? undefined,
      preferredKind: "group",
    });
    if (resolved.ok) {
      if (resolved.target.kind === "user") {
        throw new Error(`Channel id "${channelIdRaw}" resolved to a user target.`);
      }
      params.args.channelId = resolved.target.to.replace(/^(channel|group):/i, "");
    } else {
      throw resolved.error;
    }
  }
  return resolvedTarget;
}

type ResolvedActionContext = {
  cfg: CoreBlowConfig;
  params: Record<string, unknown>;
  channel: ChannelId;
  mediaLocalRoots: readonly string[];
  accountId?: string | null;
  dryRun: boolean;
  gateway?: MessageActionRunnerGateway;
  input: RunMessageActionParams;
  agentId?: string;
  resolvedTarget?: ResolvedMessagingTarget;
  abortSignal?: AbortSignal;
};
function resolveGateway(input: RunMessageActionParams): MessageActionRunnerGateway | undefined {
  if (!input.gateway) {
    return undefined;
  }
  return {
    url: input.gateway.url,
    token: input.gateway.token,
    timeoutMs: input.gateway.timeoutMs,
    clientName: input.gateway.clientName,
    clientDisplayName: input.gateway.clientDisplayName,
    mode: input.gateway.mode,
  };
}

async function handleBroadcastAction(
  input: RunMessageActionParams,
  params: Record<string, unknown>,
): Promise<MessageActionRunResult> {
  throwIfAborted(input.abortSignal);
  const broadcastEnabled = input.cfg.tools?.message?.broadcast?.enabled !== false;
  if (!broadcastEnabled) {
    throw new Error("Broadcast is disabled. Set tools.message.broadcast.enabled to true.");
  }
  const rawTargets = readStringArrayParam(params, "targets", { required: true });
  if (rawTargets.length === 0) {
    throw new Error("Broadcast requires at least one target in --targets.");
  }
  const channelHint = readStringParam(params, "channel");
  const targetChannels =
    channelHint && channelHint.trim().toLowerCase() !== "all"
      ? [await resolveChannel(input.cfg, { channel: channelHint }, input.toolContext)]
      : await (async () => {
          const configured = await listConfiguredMessageChannels(input.cfg);
          if (configured.length === 0) {
            throw new Error("Broadcast requires at least one configured channel.");
          }
          return configured;
        })();
  const results: Array<{
    channel: ChannelId;
    to: string;
    ok: boolean;
    error?: string;
    result?: MessageSendResult;
  }> = [];
  const isAbortError = (err: unknown): boolean => err instanceof Error && err.name === "AbortError";
  for (const targetChannel of targetChannels) {
    throwIfAborted(input.abortSignal);
    for (const target of rawTargets) {
      throwIfAborted(input.abortSignal);
      try {
        const resolved = await resolveChannelTarget({
          cfg: input.cfg,
          channel: targetChannel,
          input: target,
        });
        if (!resolved.ok) {
          throw resolved.error;
        }
        const sendResult = await runMessageAction({
          ...input,
          action: "send",
          params: {
            ...params,
            channel: targetChannel,
            target: resolved.target.to,
          },
        });
        results.push({
          channel: targetChannel,
          to: resolved.target.to,
          ok: true,
          result: sendResult.kind === "send" ? sendResult.sendResult : undefined,
        });
      } catch (err) {
        if (isAbortError(err)) {
          throw err;
        }
        results.push({
          channel: targetChannel,
          to: target,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return {
    kind: "broadcast",
    channel: targetChannels[0] ?? "discord",
    action: "broadcast",
    handledBy: input.dryRun ? "dry-run" : "core",
    payload: { results },
    dryRun: Boolean(input.dryRun),
  };
}

const INTERNAL_MESSAGE_CHANNEL = "webchat";

type SendPayloadParts = {
  message: string;
  payload: ReplyPayload;
  mediaUrl?: string;
  mediaUrls?: string[];
  asVoice: boolean;
  gifPlayback: boolean;
  forceDocument: boolean;
  bestEffort?: boolean;
  silent?: boolean;
};

function updateSendPayloadPartsFromReplyPayload(
  parts: SendPayloadParts,
  payload: ReplyPayload,
): SendPayloadParts {
  const sendable = resolveSendableOutboundReplyParts(payload);
  const mediaUrls = sendable.mediaUrls.length > 0 ? sendable.mediaUrls : undefined;
  return {
    ...parts,
    message: payload.text ?? "",
    payload,
    mediaUrl: mediaUrls?.[0],
    mediaUrls,
    asVoice: payload.audioAsVoice === true,
  };
}

function applySendPayloadPartsToActionParams(
  actionParams: Record<string, unknown>,
  parts: SendPayloadParts,
) {
  actionParams.message = parts.message;
  actionParams.media = parts.mediaUrl;
  actionParams.mediaUrl = parts.mediaUrl;
  actionParams.mediaUrls = parts.mediaUrls;
  actionParams.asVoice = parts.asVoice || undefined;
  actionParams.audioAsVoice = parts.asVoice || undefined;
}

function hasExplicitRouteParam(params: Record<string, unknown>): boolean {
  return (
    Boolean(readStringParam(params, "channel")) ||
    Boolean(readStringParam(params, "target")) ||
    Boolean(readStringParam(params, "to")) ||
    Boolean(readStringParam(params, "channelId")) ||
    (Array.isArray(params.targets) &&
      params.targets.some((v) => typeof v === "string" && v.trim().length > 0))
  );
}

function shouldUseInternalSourceReplySink(
  input: RunMessageActionParams,
  params: Record<string, unknown>,
) {
  return (
    input.action === "send" &&
    input.sourceReplyDeliveryMode === "message_tool_only" &&
    (input.toolContext?.currentChannelProvider ?? "").toLowerCase().trim() ===
      INTERNAL_MESSAGE_CHANNEL &&
    Boolean(input.sessionKey?.trim()) &&
    !hasExplicitRouteParam(params)
  );
}

async function buildSendPayloadParts(params: {
  cfg: CoreBlowConfig;
  actionParams: Record<string, unknown>;
  input: RunMessageActionParams;
  channel?: ChannelId;
  target?: string;
  accountId?: string | null;
  agentId?: string;
}): Promise<SendPayloadParts> {
  const { actionParams, input } = params;
  if (actionParams.pin === true && actionParams.delivery == null) {
    actionParams.delivery = { pin: { enabled: true } };
  }
  const mediaHint =
    readStringParam(actionParams, "media", { trim: false }) ??
    readStringParam(actionParams, "mediaUrl", { trim: false }) ??
    readStringParam(actionParams, "path", { trim: false }) ??
    readStringParam(actionParams, "filePath", { trim: false }) ??
    readStringParam(actionParams, "fileUrl", { trim: false });
  const hasButtons = Array.isArray(actionParams.buttons) && actionParams.buttons.length > 0;
  const hasCard = actionParams.card != null && typeof actionParams.card === "object";
  const hasComponents = actionParams.components != null && typeof actionParams.components === "object";
  const hasInteractive = hasInteractiveReplyBlocks(actionParams.interactive);
  const hasPresentation = hasMessagePresentationBlocks(actionParams.presentation);
  const hasBlocks =
    (Array.isArray(actionParams.blocks) && actionParams.blocks.length > 0) ||
    (typeof actionParams.blocks === "string" && actionParams.blocks.trim().length > 0);
  const caption = readStringParam(actionParams, "caption", { allowEmpty: true }) ?? "";
  let message =
    readStringParam(actionParams, "message", {
      required:
        !mediaHint &&
        !hasButtons &&
        !hasCard &&
        !hasComponents &&
        !hasInteractive &&
        !hasPresentation &&
        !hasBlocks,
      allowEmpty: true,
    }) ?? "";
  if (message.includes("\\n")) {
    message = message.replaceAll("\\n", "\n");
  }
  if (!message.trim() && caption.trim()) {
    message = caption;
  }

  const parsed = parseReplyDirectives(message);
  const mergedMediaUrls: string[] = [];
  const seenMedia = new Set<string>();
  const pushMedia = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || seenMedia.has(trimmed)) {
      return;
    }
    seenMedia.add(trimmed);
    mergedMediaUrls.push(trimmed);
  };
  pushMedia(mediaHint);
  for (const url of parsed.mediaUrls ?? []) {
    pushMedia(url);
  }
  pushMedia(parsed.mediaUrl);

  const normalizedMediaUrls = await normalizeSandboxMediaList({
    values: mergedMediaUrls,
    sandboxRoot: input.sandboxRoot,
  });
  mergedMediaUrls.length = 0;
  mergedMediaUrls.push(...normalizedMediaUrls);

  message = parsed.text;
  actionParams.message = message;
  if (!actionParams.replyTo && parsed.replyToId) {
    actionParams.replyTo = parsed.replyToId;
  }
  if (!actionParams.media) {
    actionParams.media = mergedMediaUrls[0] || undefined;
  }

  if (params.channel && params.target) {
    message = await maybeApplyCrossContextMarker({
      cfg: params.cfg,
      channel: params.channel,
      action: "send",
      target: params.target,
      toolContext: input.toolContext,
      accountId: params.accountId,
      args: actionParams,
      message,
      preferComponents: true,
    });
  }

  const mediaUrl = readStringParam(actionParams, "media", { trim: false });
  if (
    !hasReplyPayloadContent(
      {
        text: message,
        mediaUrl,
        mediaUrls: mergedMediaUrls,
        interactive: actionParams.interactive,
        presentation: actionParams.presentation,
      },
      {
        extraContent: hasButtons || hasCard || hasComponents || hasBlocks,
      },
    )
  ) {
    throw new Error("send requires text or media");
  }
  actionParams.message = message;
  const gifPlayback = readBooleanParam(actionParams, "gifPlayback") ?? false;
  const forceDocument =
    readBooleanParam(actionParams, "forceDocument") ??
    readBooleanParam(actionParams, "asDocument") ??
    false;
  const asVoice =
    readBooleanParam(actionParams, "asVoice") ??
    readBooleanParam(actionParams, "audioAsVoice") ??
    parsed.audioAsVoice ??
    false;
  const bestEffort = readBooleanParam(actionParams, "bestEffort");
  const silent = readBooleanParam(actionParams, "silent");
  const mirrorMediaUrls =
    mergedMediaUrls.length > 0 ? mergedMediaUrls : mediaUrl ? [mediaUrl] : undefined;
  const rawDelivery = actionParams.delivery;
  const delivery =
    rawDelivery && typeof rawDelivery === "object" && !Array.isArray(rawDelivery)
      ? (rawDelivery as Record<string, unknown>)
      : undefined;
  const rawChannelData = actionParams.channelData;
  const channelData =
    rawChannelData && typeof rawChannelData === "object" && !Array.isArray(rawChannelData)
      ? (rawChannelData as Record<string, unknown>)
      : undefined;
  const presentation = normalizeMessagePresentation(actionParams.presentation);
  const interactive = normalizeInteractiveReply(actionParams.interactive);

  return {
    message,
    payload: {
      text: message,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(mergedMediaUrls.length ? { mediaUrls: mergedMediaUrls } : {}),
      ...(asVoice ? { audioAsVoice: true } : {}),
      ...(presentation ? { presentation } : {}),
      ...(interactive ? { interactive } : {}),
      ...(delivery ? { delivery } : {}),
      ...(channelData ? { channelData } : {}),
    },
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(mirrorMediaUrls ? { mediaUrls: mirrorMediaUrls } : {}),
    asVoice,
    gifPlayback,
    forceDocument,
    bestEffort: bestEffort ?? undefined,
    silent: silent ?? undefined,
  };
}

async function handleInternalSourceReplySendAction(
  input: RunMessageActionParams,
  params: Record<string, unknown>,
): Promise<MessageActionRunResult> {
  throwIfAborted(input.abortSignal);
  const dryRun = Boolean(input.dryRun ?? readBooleanParam(params, "dryRun"));
  const sourceReply = await buildSendPayloadParts({
    cfg: input.cfg,
    actionParams: params,
    input,
    agentId:
      input.agentId ??
      (input.sessionKey
        ? resolveSessionAgentId({ sessionKey: input.sessionKey, config: input.cfg })
        : undefined),
  });
  const payload = {
    status: "ok",
    deliveryStatus: dryRun ? "dry_run" : "sent",
    channel: INTERNAL_MESSAGE_CHANNEL,
    target: "current-run",
    sourceReplyDeliveryMode: input.sourceReplyDeliveryMode,
    ...(dryRun ? {} : { sourceReplySink: "internal-ui" as const }),
    sourceReply: sourceReply.payload,
    ...(sourceReply.message ? { message: sourceReply.message } : {}),
    ...(sourceReply.mediaUrl ? { mediaUrl: sourceReply.mediaUrl } : {}),
    ...(sourceReply.mediaUrls?.length ? { mediaUrls: sourceReply.mediaUrls } : {}),
    dryRun,
  };
  return {
    kind: "send",
    channel: INTERNAL_MESSAGE_CHANNEL,
    action: "send",
    to: "current-run",
    handledBy: "internal-source",
    payload,
    dryRun,
  };
}

async function handleSendAction(ctx: ResolvedActionContext): Promise<MessageActionRunResult> {
  const {
    cfg,
    params,
    channel,
    accountId,
    dryRun,
    gateway,
    input,
    agentId,
    resolvedTarget,
    abortSignal,
  } = ctx;
  throwIfAborted(abortSignal);
  const action: ChannelMessageActionName = "send";
  const to = readStringParam(params, "to", { required: true });

  let sendPayload = await buildSendPayloadParts({
    cfg,
    actionParams: params,
    input,
    channel,
    target: to,
    accountId,
    agentId,
  });

  const replyToId = readStringParam(params, "replyTo");
  const { resolvedThreadId, outboundRoute } = await prepareOutboundMirrorRoute({
    cfg,
    channel,
    to,
    actionParams: params,
    accountId,
    toolContext: input.toolContext,
    agentId,
    dryRun,
    resolvedTarget,
    resolveAutoThreadId: getChannelPlugin(channel)?.threading?.resolveAutoThreadId,
    resolveOutboundSessionRoute,
    ensureOutboundSessionEntry,
  });
  throwIfAborted(abortSignal);

  const ttsPayload = await maybeApplyTtsToMessageActionSendPayload({
    payload: sendPayload.payload,
    cfg,
    channel,
    accountId,
    agentId,
    sessionKey: input.sessionKey,
    dryRun,
  });
  if (ttsPayload !== sendPayload.payload) {
    sendPayload = updateSendPayloadPartsFromReplyPayload(sendPayload, ttsPayload);
    applySendPayloadPartsToActionParams(params, sendPayload);
  }
  throwIfAborted(abortSignal);

  const mirrorMediaUrls =
    sendPayload.mediaUrls && sendPayload.mediaUrls.length > 0
      ? sendPayload.mediaUrls
      : sendPayload.mediaUrl
        ? [sendPayload.mediaUrl]
        : undefined;

  const send = await executeSendAction({
    ctx: {
      cfg,
      channel,
      params,
      agentId,
      accountId: accountId ?? undefined,
      gateway,
      toolContext: input.toolContext,
      deps: input.deps,
      dryRun,
      mirror:
        outboundRoute && !dryRun
          ? {
              sessionKey: outboundRoute.sessionKey,
              agentId,
              text: sendPayload.message,
              mediaUrls: mirrorMediaUrls,
            }
          : undefined,
      abortSignal,
      silent: sendPayload.silent ?? undefined,
    },
    to,
    message: sendPayload.message,
    mediaUrl: sendPayload.mediaUrl,
    mediaUrls: sendPayload.mediaUrls,
    gifPlayback: sendPayload.gifPlayback ?? false,
    forceDocument: sendPayload.forceDocument ?? false,
    bestEffort: sendPayload.bestEffort,
    replyToId: replyToId ?? undefined,
    threadId: resolvedThreadId ?? undefined,
  });

  return {
    kind: "send",
    channel,
    action,
    to,
    handledBy: send.handledBy,
    payload: send.payload,
    toolResult: send.toolResult,
    sendResult: send.sendResult,
    dryRun,
  };
}

async function handlePollAction(ctx: ResolvedActionContext): Promise<MessageActionRunResult> {
  const { cfg, params, channel, accountId, dryRun, gateway, input, abortSignal } = ctx;
  throwIfAborted(abortSignal);
  const action: ChannelMessageActionName = "poll";
  const to = readStringParam(params, "to", { required: true });
  const silent = readBooleanParam(params, "silent");

  const resolvedThreadId = resolveAndApplyOutboundThreadId(params, {
    cfg,
    to,
    accountId,
    toolContext: input.toolContext,
    resolveAutoThreadId: getChannelPlugin(channel)?.threading?.resolveAutoThreadId,
  });

  const base = typeof params.message === "string" ? params.message : "";
  await maybeApplyCrossContextMarker({
    cfg,
    channel,
    action,
    target: to,
    toolContext: input.toolContext,
    accountId,
    args: params,
    message: base,
    preferComponents: false,
  });

  const poll = await executePollAction({
    ctx: {
      cfg,
      channel,
      params,
      accountId: accountId ?? undefined,
      gateway,
      toolContext: input.toolContext,
      dryRun,
      silent: silent ?? undefined,
    },
    resolveCorePoll: () => {
      const question = readStringParam(params, "pollQuestion", {
        required: true,
      });
      const options = readStringArrayParam(params, "pollOption", { required: true });
      if (options.length < 2) {
        throw new Error("pollOption requires at least two values");
      }
      const allowMultiselect = readBooleanParam(params, "pollMulti") ?? false;
      const durationHours = readNumberParam(params, "pollDurationHours", {
        integer: true,
        strict: true,
      });

      return {
        to,
        question,
        options,
        maxSelections: resolvePollMaxSelections(options.length, allowMultiselect),
        durationHours: durationHours ?? undefined,
        threadId: resolvedThreadId ?? undefined,
      };
    },
  });

  return {
    kind: "poll",
    channel,
    action,
    to,
    handledBy: poll.handledBy,
    payload: poll.payload,
    toolResult: poll.toolResult,
    pollResult: poll.pollResult,
    dryRun,
  };
}

async function handlePluginAction(ctx: ResolvedActionContext): Promise<MessageActionRunResult> {
  const {
    cfg,
    params,
    channel,
    mediaLocalRoots,
    accountId,
    dryRun,
    gateway,
    input,
    abortSignal,
    agentId,
  } = ctx;
  throwIfAborted(abortSignal);
  const action = input.action as Exclude<ChannelMessageActionName, "send" | "poll" | "broadcast">;
  if (dryRun) {
    return {
      kind: "action",
      channel,
      action,
      handledBy: "dry-run",
      payload: { ok: true, dryRun: true, channel, action },
      dryRun: true,
    };
  }

  const plugin = resolveOutboundChannelPlugin({ channel, cfg });
  if (!plugin?.actions?.handleAction) {
    throw new Error(`Channel ${channel} is unavailable for message actions (plugin not loaded).`);
  }

  const handled = await dispatchChannelMessageAction({
    channel,
    action,
    cfg,
    params,
    mediaLocalRoots,
    accountId: accountId ?? undefined,
    requesterSenderId: input.requesterSenderId ?? undefined,
    sessionKey: input.sessionKey,
    sessionId: input.sessionId,
    agentId,
    gateway,
    toolContext: input.toolContext,
    dryRun,
  });
  if (!handled) {
    throw new Error(`Message action ${action} not supported for channel ${channel}.`);
  }
  return {
    kind: "action",
    channel,
    action,
    handledBy: "plugin",
    payload: extractToolPayload(handled),
    toolResult: handled,
    dryRun,
  };
}

export async function runMessageAction(
  input: RunMessageActionParams,
): Promise<MessageActionRunResult> {
  const cfg = input.cfg;
  let params = { ...input.params };
  const resolvedAgentId =
    input.agentId ??
    (input.sessionKey
      ? resolveSessionAgentId({ sessionKey: input.sessionKey, config: cfg })
      : undefined);
  parseJsonMessageParam(params, "presentation");
  parseJsonMessageParam(params, "delivery");
  parseButtonsParam(params);
  parseCardParam(params);
  parseComponentsParam(params);
  parseInteractiveParam(params);

  const action = input.action;
  if (action === "broadcast") {
    return handleBroadcastAction(input, params);
  }
  if (action === "send" && hasPollCreationParams(params)) {
    throw new Error('Poll fields require action "poll"; use action "poll" instead of "send".');
  }
  if (shouldUseInternalSourceReplySink(input, params)) {
    return handleInternalSourceReplySendAction({ ...input, agentId: resolvedAgentId }, params);
  }
  params = normalizeMessageActionInput({
    action,
    args: params,
    toolContext: input.toolContext,
  });

  const channel = await resolveChannel(cfg, params, input.toolContext);
  let accountId = readStringParam(params, "accountId") ?? input.defaultAccountId;
  if (!accountId && resolvedAgentId) {
    const byAgent = buildChannelAccountBindings(cfg).get(channel);
    const boundAccountIds = byAgent?.get(normalizeAgentId(resolvedAgentId));
    if (boundAccountIds && boundAccountIds.length > 0) {
      accountId = boundAccountIds[0];
    }
  }
  if (accountId) {
    params.accountId = accountId;
  }
  const dryRun = Boolean(input.dryRun ?? readBooleanParam(params, "dryRun"));
  const normalizationPolicy = resolveAttachmentMediaPolicy({
    sandboxRoot: input.sandboxRoot,
    mediaLocalRoots: getAgentScopedMediaLocalRoots(cfg, resolvedAgentId),
  });

  await normalizeSandboxMediaParams({
    args: params,
    mediaPolicy: normalizationPolicy,
  });

  const mediaLocalRoots = getAgentScopedMediaLocalRootsForSources({
    cfg,
    agentId: resolvedAgentId,
    mediaSources: collectActionMediaSourceHints(params),
  });
  const mediaPolicy = resolveAttachmentMediaPolicy({
    sandboxRoot: input.sandboxRoot,
    mediaLocalRoots,
  });

  await hydrateAttachmentParamsForAction({
    cfg,
    channel,
    accountId,
    args: params,
    action,
    dryRun,
    mediaPolicy,
  });

  const resolvedTarget = await resolveActionTarget({
    cfg,
    channel,
    action,
    args: params,
    accountId,
  });

  enforceCrossContextPolicy({
    channel,
    action,
    args: params,
    toolContext: input.toolContext,
    cfg,
  });

  if (action === "send" && hasPollCreationParams(params)) {
    throw new Error('Poll fields require action "poll"; use action "poll" instead of "send".');
  }

  const gateway = resolveGateway(input);

  if (action === "send") {
    return handleSendAction({
      cfg,
      params,
      channel,
      mediaLocalRoots,
      accountId,
      dryRun,
      gateway,
      input,
      agentId: resolvedAgentId,
      resolvedTarget,
      abortSignal: input.abortSignal,
    });
  }

  if (action === "poll") {
    return handlePollAction({
      cfg,
      params,
      channel,
      mediaLocalRoots,
      accountId,
      dryRun,
      gateway,
      input,
      abortSignal: input.abortSignal,
    });
  }

  return handlePluginAction({
    cfg,
    params,
    channel,
    mediaLocalRoots,
    accountId,
    dryRun,
    gateway,
    input,
    agentId: resolvedAgentId,
    abortSignal: input.abortSignal,
  });
}

// ---------------------------------------------------------------------------
// MessageActionRunnerService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "../service-patterns.js";
/**
 * Tier-1 service wrapping message action execution (send, poll, broadcast).
 * Thin facade over existing `runMessageAction` and `getToolResult`.
 */
export class MessageActionRunnerService {
  /**
   * Run a message action (send, poll, broadcast, or plugin action).
   */
  async run(input: RunMessageActionParams): Promise<MessageActionRunResult> {
    return runMessageAction(input);
  }

  /**
   * Extract tool result from a message action result.
   */
  getToolResult(result: MessageActionRunResult) {
    return getToolResult(result);
  }
}


const { getInstance: getMessageActionRunnerService, __testing: __testing_messageActionRunner } =
  createStandaloneSingleton({ create: () => new MessageActionRunnerService(), defaultDeps: {} });

export { getMessageActionRunnerService, __testing_messageActionRunner };
/** Get the default MessageActionRunnerService singleton. */
/** @internal Testing hooks — guarded by NODE_ENV. */
