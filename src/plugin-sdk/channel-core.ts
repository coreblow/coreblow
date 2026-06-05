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

export function buildThreadAwareOutboundSessionRoute(params: {
  route: Record<string, unknown>;
  replyToId?: unknown;
  threadId?: unknown;
  currentSessionKey?: unknown;
  canRecoverCurrentThread?: () => boolean;
}): Record<string, unknown> {
  return {
    ...params.route,
    ...(params.replyToId !== undefined ? { replyToId: params.replyToId } : {}),
    ...(params.threadId !== undefined ? { threadId: params.threadId } : {}),
    ...(params.currentSessionKey !== undefined
      ? { currentSessionKey: params.currentSessionKey }
      : {}),
  };
}
