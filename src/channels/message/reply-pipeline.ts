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
import {
  resolveSourceReplyDeliveryMode,
  type SourceReplyDeliveryMode,
  type SourceReplyDeliveryModeContext,
} from "../../auto-reply/reply/source-reply-delivery-mode.js";

export type ReplyPrefixContext = ReplyPrefixContextBundle["prefixContext"];
export type { ReplyPrefixContextBundle, ReplyPrefixOptions };
export type { CreateTypingCallbacksParams, TypingCallbacks };
export { createReplyPrefixContext, createReplyPrefixOptions, createTypingCallbacks };
export type { SourceReplyDeliveryMode, SourceReplyDeliveryModeContext };

export function resolveChannelSourceReplyDeliveryMode(params: {
  cfg: CoreBlowConfig;
  ctx: SourceReplyDeliveryModeContext;
  requested?: SourceReplyDeliveryMode;
  messageToolAvailable?: boolean;
}): SourceReplyDeliveryMode {
  return resolveSourceReplyDeliveryMode(params);
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

export function createChannelReplyPipeline(
  params: CreateChannelReplyPipelineParams,
): ChannelReplyPipeline {
  const channelId = params.channel
    ? (normalizeAnyChannelId(params.channel) ?? params.channel)
    : undefined;
  let plugin: ReturnType<typeof getChannelPlugin> | undefined;
  let pluginTransformResolved = false;
  const resolvePluginTransform = () => {
    if (pluginTransformResolved) {
      return plugin?.messaging?.transformReplyPayload;
    }
    pluginTransformResolved = true;
    plugin = channelId ? getChannelPlugin(channelId as Parameters<typeof getChannelPlugin>[0]) : undefined;
    return plugin?.messaging?.transformReplyPayload;
  };
  const transformReplyPayload = params.transformReplyPayload
    ? params.transformReplyPayload
    : channelId
      ? (payload: ReplyPayload) =>
          resolvePluginTransform()?.({
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
