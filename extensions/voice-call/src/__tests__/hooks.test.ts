import { describe, it, expect } from 'vitest';
import { VoiceCallSubagentHooks } from '../subagent-hooks.js';

describe('VoiceCallSubagentHooks', () => {
  it('should register and trigger hooks', async () => {
    const hooks = new VoiceCallSubagentHooks();
    let called = false;
    hooks.register('beforeSend', () => { called = true; });
    await hooks.onBeforeSend({ channelId: 'ch1', userId: 'u1', messageId: 'm1', content: 'test', metadata: {} });
    expect(called).toBe(true);
  });
});
