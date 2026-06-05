import { describe, it, expect } from 'vitest';
import { AcpSubagentHooks } from '../subagent-hooks.js';

describe('AcpSubagentHooks', () => {
  it('should register and trigger hooks', async () => {
    const hooks = new AcpSubagentHooks();
    let called = false;
    hooks.register('beforeSend', () => { called = true; });
    await hooks.onBeforeSend({ channelId: 'ch1', userId: 'u1', messageId: 'm1', content: 'test', metadata: {} });
    expect(called).toBe(true);
  });
});
