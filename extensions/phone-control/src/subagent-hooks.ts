// @ts-nocheck
/**
 * PhoneControl Subagent Hooks
 */
export interface PhoneControlHookContext {
  channelId: string;
  userId: string;
  messageId: string;
  content: string;
  metadata: Record<string, any>;
}

export class PhoneControlSubagentHooks {
  private hooks = new Map<string, Function[]>();

  register(event: string, handler: Function) {
    const list = this.hooks.get(event) || [];
    list.push(handler);
    this.hooks.set(event, list);
  }

  async trigger(event: string, context: PhoneControlHookContext) {
    const handlers = this.hooks.get(event) || [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(context));
    }
    return results;
  }

  async onBeforeSend(context: PhoneControlHookContext) {
    return this.trigger('beforeSend', context);
  }

  async onAfterReceive(context: PhoneControlHookContext) {
    return this.trigger('afterReceive', context);
  }

  async onError(error: Error, context: PhoneControlHookContext) {
    return this.trigger('error', { ...context, error: error.message });
  }
}
