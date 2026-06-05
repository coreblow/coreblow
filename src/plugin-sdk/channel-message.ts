export function createMessageReceiptFromOutboundResults(params: Record<string, unknown>) {
  return params;
}

export function defineChannelMessageAdapter<T extends Record<string, unknown>>(adapter: T): T {
  return adapter;
}

export function createChannelMessageReplyPipeline() {
  return {
    async dispatch() {
      return undefined;
    },
  };
}
