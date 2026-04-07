import { describe, it, expect } from 'vitest';
import { CopilotProxySubagentHooks } from '../subagent-hooks';

describe('CopilotProxySubagentHooks', () => {
  it('should register and trigger hooks', async () => {
    const hooks = new CopilotProxySubagentHooks();
    let called = false;
    hooks.register('beforeSend', () => { called = true; });
    await hooks.onBeforeSend({ channelId: 'ch1', userId: 'u1', messageId: 'm1', content: 'test', metadata: {} });
    expect(called).toBe(true);
  });
});
