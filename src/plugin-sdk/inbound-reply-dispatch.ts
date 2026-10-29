import { withReplyDispatcher } from "../auto-reply/dispatch.js";
import {
  dispatchReplyFromConfig,
  type DispatchFromConfigResult,
} from "../auto-reply/reply/dispatch-from-config.js";
import type { ReplyDispatcher } from "../auto-reply/reply/reply-dispatcher.js";
import type { FinalizedMsgContext } from "../auto-reply/templating.js";
import type { GetReplyOptions } from "../auto-reply/types.js";
import type { CoreBlowConfig } from "../config/config.js";
import { createChannelReplyPipeline } from "./channel-reply-pipeline.js";
import { createNormalizedOutboundDeliverer, type OutboundReplyPayload } from "./reply-payload.js";

export {
  hasFinalChannelTurnDispatch as hasFinalInboundReplyDispatch,
  hasVisibleChannelTurnDispatch as hasVisibleInboundReplyDispatch,
  resolveChannelTurnDispatchCounts as resolveInboundReplyDispatchCounts,
  hasFinalChannelTurnDispatch,
  hasVisibleChannelTurnDispatch,
  resolveChannelTurnDispatchCounts,
  EMPTY_CHANNEL_TURN_DISPATCH_COUNTS,
  type ChannelTurnDispatchResultLike,
  type ChannelTurnVisibleDeliverySignals,
} from "../channels/turn/dispatch-result.js";
import {
  recordChannelBotPairLoopAndCheckSuppression,
  type ChannelBotLoopProtectionFacts,
} from "../channels/turn/bot-loop-protection.js";

export {
  clearChannelBotPairLoopGuardForTests,
  listTrackedChannelBotPairsForTests,
  recordChannelBotPairLoopAndCheckSuppression,
  type ChannelBotLoopProtectionFacts,
} from "../channels/turn/bot-loop-protection.js";

export type ChannelTurnRecordOptions = {
  groupResolution?: boolean;
  createIfMissing?: boolean;
  updateLastRoute?: boolean;
  onRecordError?: (err: unknown) => void;
  trackSessionMetaTask?: boolean;
};

export type PreparedChannelTurn<TDispatchResult = unknown> = {
  channel: string;
  accountId?: string;
  routeSessionKey: string;
  storePath: string;
  ctxPayload: FinalizedMsgContext;
  recordInboundSession: (params: {
    storePath: string;
    sessionKey: string;
    ctx: FinalizedMsgContext;
    groupResolution?: boolean;
    createIfMissing?: boolean;
    updateLastRoute?: boolean;
    onRecordError?: (err: unknown) => void;
    trackSessionMetaTask?: boolean;
  }) => Promise<unknown>;
  record?: ChannelTurnRecordOptions;
  history?: {
    clearPending?: () => void;
    clearPendingHistory?: () => void;
  };
  botLoopProtection?: ChannelBotLoopProtectionFacts;
  onPreDispatchFailure?: (err: unknown) => Promise<void> | void;
  runDispatch: () => Promise<TDispatchResult>;
  messageId?: string;
  admission?: { kind: string; reason?: string };
};

export type ChannelTurnResult<TDispatchResult = unknown> =
  | {
      dispatched: true;
      admission?: { kind: string; reason?: string };
      ctxPayload: FinalizedMsgContext;
      routeSessionKey: string;
      dispatchResult: TDispatchResult;
    }
  | {
      dispatched: false;
      admission: { kind: string; reason?: string };
    };

export async function runPreparedInboundReplyTurn<TDispatchResult = unknown>(
  params: PreparedChannelTurn<TDispatchResult>,
): Promise<ChannelTurnResult<TDispatchResult>> {
  if (params.botLoopProtection) {
    const botLoopResult = recordChannelBotPairLoopAndCheckSuppression(params.botLoopProtection);
    if (botLoopResult.suppressed) {
      params.history?.clearPending?.();
      params.history?.clearPendingHistory?.();
      return {
        dispatched: false,
        admission: { kind: "drop", reason: "bot-loop-protection" },
      };
    }
  }

  try {
    await params.recordInboundSession({
      storePath: params.storePath,
      sessionKey: params.ctxPayload.SessionKey ?? params.routeSessionKey,
      ctx: params.ctxPayload,
      groupResolution: params.record?.groupResolution,
      createIfMissing: params.record?.createIfMissing,
      updateLastRoute: params.record?.updateLastRoute,
      onRecordError: params.record?.onRecordError ?? (() => undefined),
      trackSessionMetaTask: params.record?.trackSessionMetaTask,
    });
  } catch (err) {
    try {
      await params.onPreDispatchFailure?.(err);
    } catch {
      // Preserve the original session-recording error.
    }
    throw err;
  }

  const dispatchResult = await params.runDispatch();
  params.history?.clearPending?.();
  params.history?.clearPendingHistory?.();

  return {
    dispatched: true,
    admission: params.admission ?? { kind: "dispatch" },
    ctxPayload: params.ctxPayload,
    routeSessionKey: params.routeSessionKey,
    dispatchResult,
  };
}

export async function recordDroppedChannelTurnHistory(params: {
  input: {
    id: string;
    timestamp?: number;
    rawText: string;
    textForAgent?: string;
    raw?: unknown;
  };
  admission?: { kind: string; reason?: string; recordHistory?: boolean };
  preflight?: any;
}): Promise<void> {
  const admission = params.admission ?? params.preflight?.admission;
  if (admission?.kind !== "drop") {
    return;
  }
  const history = params.preflight?.history;
  if (!history || history.limit <= 0 || !(history.recordOnDrop || admission.recordHistory)) {
    return;
  }
  const body = params.input.rawText || params.input.textForAgent || "";
  if (!body.trim()) {
    return;
  }
  history.historyMap?.append?.(params.preflight?.historyKey, {
    sender: params.preflight?.sender ?? params.preflight?.user,
    body,
    timestamp: params.input.timestamp,
    messageId: params.input.id,
  });
}

type ReplyOptionsWithoutModelSelected = Omit<
  Omit<GetReplyOptions, "onToolResult" | "onBlockReply">,
  "onModelSelected"
>;
type RecordInboundSessionFn = typeof import("../channels/session.js").recordInboundSession;
type DispatchReplyWithBufferedBlockDispatcherFn =
  typeof import("../auto-reply/reply/provider-dispatcher.js").dispatchReplyWithBufferedBlockDispatcher;

/** Minimal adapter interface for runInboundReplyTurn compatibility bridge. */
export type ChannelTurnIngestResult<TRaw = unknown> = {
  id: string;
  rawText: string;
  textForAgent: string;
  textForCommands: string;
  raw: TRaw;
};

export type ChannelTurnResolved = {
  cfg: CoreBlowConfig;
  channel: string;
  accountId?: string;
  agentId: string;
  routeSessionKey: string;
  storePath: string;
  ctxPayload: FinalizedMsgContext;
  recordInboundSession: RecordInboundSessionFn;
  dispatchReplyWithBufferedBlockDispatcher: DispatchReplyWithBufferedBlockDispatcherFn;
  record?: {
    updateLastRoute?: unknown;
    onRecordError?: (err: unknown) => void;
  };
  delivery: {
    deliver: (payload: OutboundReplyPayload, info?: { kind?: string }) => Promise<void>;
  };
  replyOptions?: ReplyOptionsWithoutModelSelected;
};

export type ChannelTurnAdapter<TRaw = unknown, TDispatchResult = unknown> = {
  ingest: (raw: TRaw) => ChannelTurnIngestResult<TRaw>;
  resolveTurn: (ingestResult: ChannelTurnIngestResult<TRaw>) => ChannelTurnResolved;
};

export type RunChannelTurnParams<TRaw = unknown, TDispatchResult = unknown> = {
  channel: string;
  accountId?: string;
  raw: TRaw;
  adapter: ChannelTurnAdapter<TRaw, TDispatchResult>;
  log?: (event: unknown) => void;
};

/**
 * CoreBlow-native compatibility bridge for OpenClaw's runInboundReplyTurn.
 * Delegates to CoreBlow's existing recordInboundSessionAndDispatchReply infrastructure.
 */
export async function runInboundReplyTurn<TRaw = unknown, TDispatchResult = unknown>(
  params: RunChannelTurnParams<TRaw, TDispatchResult>,
): Promise<void> {
  const ingestResult = params.adapter.ingest(params.raw);
  const resolved = params.adapter.resolveTurn(ingestResult);

  const onRecordError = resolved.record?.onRecordError ?? (() => {});
  const onDispatchError = (err: unknown, info: { kind: string }) => {
    params.log?.({ type: "dispatch-error", error: err, info });
  };

  await recordInboundSessionAndDispatchReply({
    cfg: resolved.cfg,
    channel: resolved.channel,
    accountId: resolved.accountId,
    agentId: resolved.agentId,
    routeSessionKey: resolved.routeSessionKey,
    storePath: resolved.storePath,
    ctxPayload: resolved.ctxPayload,
    recordInboundSession: resolved.recordInboundSession,
    dispatchReplyWithBufferedBlockDispatcher: resolved.dispatchReplyWithBufferedBlockDispatcher,
    deliver: resolved.delivery.deliver,
    onRecordError,
    onDispatchError,
    replyOptions: resolved.replyOptions,
  });
}

type ReplyDispatchFromConfigOptions = Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;

/** Run `dispatchReplyFromConfig` with a dispatcher that always gets its settled callback. */
export async function dispatchReplyFromConfigWithSettledDispatcher(params: {
  cfg: CoreBlowConfig;
  ctxPayload: FinalizedMsgContext;
  dispatcher: ReplyDispatcher;
  onSettled: () => void | Promise<void>;
  replyOptions?: ReplyDispatchFromConfigOptions;
  configOverride?: CoreBlowConfig;
}): Promise<DispatchFromConfigResult> {
  return await withReplyDispatcher({
    dispatcher: params.dispatcher,
    onSettled: params.onSettled,
    run: () =>
      dispatchReplyFromConfig({
        ctx: params.ctxPayload,
        cfg: params.cfg,
        dispatcher: params.dispatcher,
        replyOptions: params.replyOptions,
        configOverride: params.configOverride,
      }),
  });
}

/** Assemble the common inbound reply dispatch dependencies for a resolved route. */
export function buildInboundReplyDispatchBase(params: {
  cfg: CoreBlowConfig;
  channel: string;
  accountId?: string;
  route: {
    agentId: string;
    sessionKey: string;
  };
  storePath: string;
  ctxPayload: FinalizedMsgContext;
  core: {
    channel: {
      session: {
        recordInboundSession: RecordInboundSessionFn;
      };
      reply: {
        dispatchReplyWithBufferedBlockDispatcher: DispatchReplyWithBufferedBlockDispatcherFn;
      };
    };
  };
}) {
  return {
    cfg: params.cfg,
    channel: params.channel,
    accountId: params.accountId,
    agentId: params.route.agentId,
    routeSessionKey: params.route.sessionKey,
    storePath: params.storePath,
    ctxPayload: params.ctxPayload,
    recordInboundSession: params.core.channel.session.recordInboundSession,
    dispatchReplyWithBufferedBlockDispatcher:
      params.core.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
  };
}

type BuildInboundReplyDispatchBaseParams = Parameters<typeof buildInboundReplyDispatchBase>[0];
type RecordInboundSessionAndDispatchReplyParams = Parameters<
  typeof recordInboundSessionAndDispatchReply
>[0];

/** Resolve the shared dispatch base and immediately record + dispatch one inbound reply turn. */
export async function dispatchInboundReplyWithBase(
  params: BuildInboundReplyDispatchBaseParams &
    Pick<
      RecordInboundSessionAndDispatchReplyParams,
      "deliver" | "onRecordError" | "onDispatchError" | "replyOptions"
    >,
): Promise<void> {
  const dispatchBase = buildInboundReplyDispatchBase(params);
  await recordInboundSessionAndDispatchReply({
    ...dispatchBase,
    deliver: params.deliver,
    onRecordError: params.onRecordError,
    onDispatchError: params.onDispatchError,
    replyOptions: params.replyOptions,
  });
}

/** Record the inbound session first, then dispatch the reply using normalized outbound delivery. */
export async function recordInboundSessionAndDispatchReply(params: {
  cfg: CoreBlowConfig;
  channel: string;
  accountId?: string;
  agentId: string;
  routeSessionKey: string;
  storePath: string;
  ctxPayload: FinalizedMsgContext;
  recordInboundSession: RecordInboundSessionFn;
  dispatchReplyWithBufferedBlockDispatcher: DispatchReplyWithBufferedBlockDispatcherFn;
  deliver: (payload: OutboundReplyPayload) => Promise<void>;
  onRecordError: (err: unknown) => void;
  onDispatchError: (err: unknown, info: { kind: string }) => void;
  replyOptions?: ReplyOptionsWithoutModelSelected;
}): Promise<void> {
  await params.recordInboundSession({
    storePath: params.storePath,
    sessionKey: params.ctxPayload.SessionKey ?? params.routeSessionKey,
    ctx: params.ctxPayload,
    onRecordError: params.onRecordError,
  });

  const { onModelSelected, ...replyPipeline } = createChannelReplyPipeline({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: params.channel,
    accountId: params.accountId,
  });
  const deliver = createNormalizedOutboundDeliverer(params.deliver);

  await params.dispatchReplyWithBufferedBlockDispatcher({
    ctx: params.ctxPayload,
    cfg: params.cfg,
    dispatcherOptions: {
      ...replyPipeline,
      deliver,
      onError: params.onDispatchError,
    },
    replyOptions: {
      ...params.replyOptions,
      onModelSelected,
    },
  });
}
