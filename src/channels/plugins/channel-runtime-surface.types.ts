export type ChannelRuntimeContextKey = {
  channelId: string;
  accountId?: string | null;
  capability: string;
};

export type ChannelRuntimeContextEvent = {
  type: "registered" | "unregistered";
  key: {
    channelId: string;
    accountId?: string;
    capability: string;
  };
  context?: unknown;
};

export type ChannelRuntimeContextRegistry = {
  register: (
    params: ChannelRuntimeContextKey & {
      context: unknown;
      abortSignal?: AbortSignal;
    },
  ) => { dispose: () => void };
  get: <T = unknown>(params: ChannelRuntimeContextKey) => T | undefined;
  watch: (params: {
    channelId?: string;
    accountId?: string | null;
    capability?: string;
    onEvent: (event: ChannelRuntimeContextEvent) => void;
  }) => () => void;
};

export type ChannelRuntimeSurface = {
  runtimeContexts: ChannelRuntimeContextRegistry;
  [key: string]: unknown;
};
