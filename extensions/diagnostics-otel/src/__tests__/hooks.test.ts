import { describe, it, expect } from 'vitest';
import { DiagnosticsOtelSubagentHooks } from '../subagent-hooks';

describe('DiagnosticsOtelSubagentHooks', () => {
  it('should register and trigger hooks', async () => {
    const hooks = new DiagnosticsOtelSubagentHooks();
    let called = false;
    hooks.register('beforeSend', () => { called = true; });
    await hooks.onBeforeSend({ channelId: 'ch1', userId: 'u1', messageId: 'm1', content: 'test', metadata: {} });
    expect(called).toBe(true);
  });
});
