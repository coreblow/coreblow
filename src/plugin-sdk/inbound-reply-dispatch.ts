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
  dispatchReplyWithBufferedBlockDispatcherFn: DispatchReplyWithBufferedBlockDispatcherFn;
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
    dispatchReplyWithBufferedBlockDispatcher: resolved.dispatchReplyWithBufferedBlockDispatcherFn,
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
