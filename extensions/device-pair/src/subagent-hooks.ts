/**
 * DevicePair Subagent Hooks
 */
export interface DevicePairHookContext {
  channelId: string;
  userId: string;
  messageId: string;
  content: string;
  metadata: Record<string, any>;
}

export class DevicePairSubagentHooks {
  private hooks = new Map<string, Function[]>();

  register(event: string, handler: Function) {
    const list = this.hooks.get(event) || [];
    list.push(handler);
    this.hooks.set(event, list);
  }

  async trigger(event: string, context: DevicePairHookContext) {
    const handlers = this.hooks.get(event) || [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(context));
    }
    return results;
  }

  async onBeforeSend(context: DevicePairHookContext) {
    return this.trigger('beforeSend', context);
  }

  async onAfterReceive(context: DevicePairHookContext) {
    return this.trigger('afterReceive', context);
  }

  async onError(error: Error, context: DevicePairHookContext) {
    return this.trigger('error', { ...context, error: error.message });
  }
}
