import type { ReplyPayload } from "../../auto-reply/types.js";
import type { CoreBlowConfig } from "../../config/config.js";
import { getChannelPlugin } from "../plugins/index.js";
import { normalizeAnyChannelId } from "../registry.js";
import {
  createReplyPrefixContext,
  createReplyPrefixOptions,
  type ReplyPrefixContextBundle,
  type ReplyPrefixOptions,
} from "../reply-prefix.js";
import {
  createTypingCallbacks,
  type CreateTypingCallbacksParams,
  type TypingCallbacks,
} from "../typing.js";

export type SourceReplyDeliveryMode = "automatic" | "message_tool_only";
export type SourceReplyDeliveryModeContext = {
  channel?: string | null;
  source?: string | null;
  messageToolAvailable?: boolean;
};

export type ReplyPrefixContext = ReplyPrefixContextBundle["prefixContext"];
export type { ReplyPrefixContextBundle, ReplyPrefixOptions };
export type { CreateTypingCallbacksParams, TypingCallbacks };
export { createReplyPrefixContext, createReplyPrefixOptions, createTypingCallbacks };

type ChannelMessageTransform = (params: {
  payload: ReplyPayload;
  cfg: CoreBlowConfig;
  accountId?: string;
}) => ReplyPayload | null;

export function resolveChannelSourceReplyDeliveryMode(params: {
  cfg: CoreBlowConfig;
  ctx: SourceReplyDeliveryModeContext;
  requested?: SourceReplyDeliveryMode;
  messageToolAvailable?: boolean;
}): SourceReplyDeliveryMode | undefined {
  if (params.requested === "message_tool_only") {
    return "message_tool_only";
  }
  return params.messageToolAvailable || params.ctx.messageToolAvailable
    ? "message_tool_only"
    : undefined;
}

export type ChannelReplyPipeline = ReplyPrefixOptions & {
  typingCallbacks?: TypingCallbacks;
  transformReplyPayload?: (payload: ReplyPayload) => ReplyPayload | null;
};

export type CreateChannelReplyPipelineParams = {
  cfg: Parameters<typeof createReplyPrefixOptions>[0]["cfg"];
  agentId: string;
  channel?: string;
  accountId?: string;
  typing?: CreateTypingCallbacksParams;
  typingCallbacks?: TypingCallbacks;
  transformReplyPayload?: (payload: ReplyPayload) => ReplyPayload | null;
};

function resolvePluginTransform(channelId: string | undefined): ChannelMessageTransform | undefined {
  if (!channelId) {
    return undefined;
  }
  const plugin = getChannelPlugin(channelId as Parameters<typeof getChannelPlugin>[0]);
  return (plugin?.messaging as { transformReplyPayload?: ChannelMessageTransform } | undefined)
    ?.transformReplyPayload;
}

export function createChannelReplyPipeline(
  params: CreateChannelReplyPipelineParams,
): ChannelReplyPipeline {
  const channelId = params.channel
    ? (normalizeAnyChannelId(params.channel) ?? params.channel)
    : undefined;
  let pluginTransform: ChannelMessageTransform | undefined;
  let pluginTransformResolved = false;
  const getPluginTransform = () => {
    if (!pluginTransformResolved) {
      pluginTransformResolved = true;
      pluginTransform = resolvePluginTransform(channelId);
    }
    return pluginTransform;
  };
  const transformReplyPayload = params.transformReplyPayload
    ? params.transformReplyPayload
    : channelId
      ? (payload: ReplyPayload) =>
          getPluginTransform()?.({
            payload,
            cfg: params.cfg,
            accountId: params.accountId,
          }) ?? payload
      : undefined;
  return {
    ...createReplyPrefixOptions({
      cfg: params.cfg,
      agentId: params.agentId,
      channel: params.channel,
      accountId: params.accountId,
    }),
    ...(transformReplyPayload ? { transformReplyPayload } : {}),
    ...(params.typingCallbacks
      ? { typingCallbacks: params.typingCallbacks }
      : params.typing
        ? { typingCallbacks: createTypingCallbacks(params.typing) }
        : {}),
  };
}
