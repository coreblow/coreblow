/**
 * Line Subagent Hooks
 */
export interface LineHookContext {
  channelId: string;
  userId: string;
  messageId: string;
  content: string;
  metadata: Record<string, any>;
}

export class LineSubagentHooks {
  private hooks = new Map<string, Function[]>();

  register(event: string, handler: Function) {
    const list = this.hooks.get(event) || [];
    list.push(handler);
    this.hooks.set(event, list);
  }

  async trigger(event: string, context: LineHookContext) {
    const handlers = this.hooks.get(event) || [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(context));
    }
    return results;
  }

  async onBeforeSend(context: LineHookContext) {
    return this.trigger('beforeSend', context);
  }

  async onAfterReceive(context: LineHookContext) {
    return this.trigger('afterReceive', context);
  }

  async onError(error: Error, context: LineHookContext) {
    return this.trigger('error', { ...context, error: error.message });
  }
}
