export type ChannelPlugin<TAccount = unknown> = {
  id?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

export function createChatChannelPlugin<TAccount>(params: {
  base: ChannelPlugin<TAccount>;
  outbound?: Record<string, unknown>;
}): ChannelPlugin<TAccount> {
  return { ...params.base, outbound: params.outbound };
}

export { buildChannelOutboundSessionRoute } from "./core.js";

import type { ChannelOutboundSessionRoute } from "../channels/plugins/types.core.js";

export function buildThreadAwareOutboundSessionRoute<
  TRoute extends ChannelOutboundSessionRoute = ChannelOutboundSessionRoute,
>(params: {
  route: TRoute;
  replyToId?: unknown;
  threadId?: unknown;
  currentSessionKey?: unknown;
  canRecoverCurrentThread?: () => boolean;
  precedence?: readonly string[];
  useSuffix?: boolean;
}): TRoute {
  return {
    ...params.route,
    ...(params.threadId !== undefined && params.threadId !== null
      ? { threadId: params.threadId as string | number }
      : {}),
  };
}
