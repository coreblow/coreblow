import { describe, it, expect } from 'vitest';
import { LlmTaskExtension } from '../../extension';
import { LlmTaskRuntime } from '../runtime';

describe('LlmTaskRuntime', () => {
  it('should start and stop', async () => {
    const ext = new LlmTaskExtension();
    const runtime = new LlmTaskRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new LlmTaskExtension();
    const runtime = new LlmTaskRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new LlmTaskExtension();
    const runtime = new LlmTaskRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
