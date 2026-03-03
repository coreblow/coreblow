// @ts-nocheck
/**
 * TestUtils Subagent Hooks
 */
export interface TestUtilsHookContext {
  channelId: string;
  userId: string;
  messageId: string;
  content: string;
  metadata: Record<string, any>;
}

export class TestUtilsSubagentHooks {
  private hooks = new Map<string, Function[]>();

  register(event: string, handler: Function) {
    const list = this.hooks.get(event) || [];
    list.push(handler);
    this.hooks.set(event, list);
  }

  async trigger(event: string, context: TestUtilsHookContext) {
    const handlers = this.hooks.get(event) || [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(context));
    }
    return results;
  }

  async onBeforeSend(context: TestUtilsHookContext) {
    return this.trigger('beforeSend', context);
  }

  async onAfterReceive(context: TestUtilsHookContext) {
    return this.trigger('afterReceive', context);
  }

  async onError(error: Error, context: TestUtilsHookContext) {
    return this.trigger('error', { ...context, error: error.message });
  }
}
