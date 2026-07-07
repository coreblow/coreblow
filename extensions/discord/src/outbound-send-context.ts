import type { CoreBlowConfig, ReplyToMode } from "coreblow/plugin-sdk/config-contracts";
import { createReplyToFanout, type ReplyToResolution } from "coreblow/plugin-sdk/outbound-runtime";
import {
  resolveOutboundSendDep,
  type OutboundSendDeps,
} from "coreblow/plugin-sdk/outbound-send-deps";
import { normalizeOptionalStringifiedId } from "coreblow/plugin-sdk/string-coerce-runtime";
import { withDiscordDeliveryRetry } from "./delivery-retry.js";

type DiscordSendRuntime = typeof import("./send.js");

export type DiscordSendFn = DiscordSendRuntime["sendMessageDiscord"];
export type DiscordVoiceSendFn = DiscordSendRuntime["sendVoiceMessageDiscord"];
type DiscordFormattingOptions = {
  textLimit?: number;
  maxLinesPerMessage?: number;
};

let discordSendRuntimePromise: Promise<DiscordSendRuntime> | undefined;

export async function loadDiscordSendRuntime(): Promise<DiscordSendRuntime> {
  discordSendRuntimePromise ??= import("./send.js");
  return await discordSendRuntimePromise;
}

export function resolveDiscordOutboundTarget(params: {
  to: string;
  threadId?: string | number | null;
}): string {
  if (params.threadId == null) {
    return params.to;
  }
  const threadId = normalizeOptionalStringifiedId(params.threadId) ?? "";
  if (!threadId) {
    return params.to;
  }
  return `channel:${threadId}`;
}

export function resolveDiscordFormattingOptions(ctx: {
  formatting?: DiscordFormattingOptions;
}): DiscordFormattingOptions {
  const formatting = ctx.formatting;
  return {
    textLimit: formatting?.textLimit,
    maxLinesPerMessage: formatting?.maxLinesPerMessage,
  };
}

export async function createDiscordPayloadSendContext(ctx: {
  cfg: CoreBlowConfig;
  to: string;
  accountId?: string | null;
  deps?: OutboundSendDeps;
  replyToId?: string | null;
  replyToIdSource?: ReplyToResolution["source"];
  replyToMode?: ReplyToMode;
  formatting?: DiscordFormattingOptions;
  threadId?: string | number | null;
}): Promise<{
  target: string;
  formatting: DiscordFormattingOptions;
  resolveReplyTo: () => string | undefined;
  send: DiscordSendFn;
  sendVoice: DiscordVoiceSendFn;
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
}> {
  const runtime = await loadDiscordSendRuntime();
  return {
    target: resolveDiscordOutboundTarget({ to: ctx.to, threadId: ctx.threadId }),
    formatting: resolveDiscordFormattingOptions(ctx),
    resolveReplyTo: createReplyToFanout({
      replyToId: ctx.replyToId,
      replyToIdSource: ctx.replyToIdSource,
      replyToMode: ctx.replyToMode,
    }),
    send: resolveOutboundSendDep<DiscordSendFn>(ctx.deps, "discord") ?? runtime.sendMessageDiscord,
    sendVoice:
      ((ctx.deps as Record<string, unknown> | undefined)?.["discordVoice"] as DiscordVoiceSendFn | undefined) ??
      runtime.sendVoiceMessageDiscord,
    withRetry: async (fn) =>
      await withDiscordDeliveryRetry({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
        fn,
      }),
  };
}
