// @ts-nocheck
/**
 * NextcloudTalk Subagent Hooks
 */
export interface NextcloudTalkHookContext {
  channelId: string;
  userId: string;
  messageId: string;
  content: string;
  metadata: Record<string, any>;
}

export class NextcloudTalkSubagentHooks {
  private hooks = new Map<string, Function[]>();

  register(event: string, handler: Function) {
    const list = this.hooks.get(event) || [];
    list.push(handler);
    this.hooks.set(event, list);
  }

  async trigger(event: string, context: NextcloudTalkHookContext) {
    const handlers = this.hooks.get(event) || [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(context));
    }
    return results;
  }

  async onBeforeSend(context: NextcloudTalkHookContext) {
    return this.trigger('beforeSend', context);
  }

  async onAfterReceive(context: NextcloudTalkHookContext) {
    return this.trigger('afterReceive', context);
  }

  async onError(error: Error, context: NextcloudTalkHookContext) {
    return this.trigger('error', { ...context, error: error.message });
  }
}
